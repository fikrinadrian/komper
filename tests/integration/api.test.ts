import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '@server/app.js';
import { createServices } from '@server/services/market-data.js';

const app = createApp(createServices('fixture'));

describe('Market Lens BFF', () => {
  it('returns a validated three-venue intersection catalog', async () => {
    const response = await request(app).get('/api/catalog').expect(200);
    expect(response.body.requiredVenueCount).toBe(3);
    expect(
      response.body.instruments.filter((item: { selectable: boolean }) => item.selectable),
    ).toHaveLength(18);
  });

  it('supports buy by IDR budget and sell by asset quantity', async () => {
    const buy = await request(app)
      .get('/api/comparisons?asset=BTC&side=buy&amount=5000000')
      .expect(200);
    const sell = await request(app)
      .get('/api/comparisons?asset=BTC&side=sell&amount=0.1')
      .expect(200);
    expect(buy.body.request.side).toBe('buy');
    expect(buy.body.results[0].outcomeAsset).toBe('BTC');
    expect(buy.body.results[0]).toMatchObject({
      roundingMode: 'FLOOR',
      requestedQuoteBudget: '5000000',
      ruleMetadataVersion: 'fixture-indodax-v1',
      priceIncrementRule: { state: 'VERIFIED', normalizedStep: '0.01' },
      quantityIncrementRule: { state: 'VERIFIED', normalizedStep: '0.00000001' },
    });
    expect(buy.body.results[0].executableBaseQuantity).toBeDefined();
    expect(buy.body.results[0].filledNotional).toBeDefined();
    expect(buy.body.results[0].unspentQuoteAmount).toBeDefined();
    expect(sell.body.request.side).toBe('sell');
    expect(sell.body.results[0].outcomeAsset).toBe('IDR');
  });

  it('compares last prices for the market catalog across venues', async () => {
    const response = await request(app).get('/api/markets').expect(200);
    expect(response.body.schemaVersion).toBe('1');
    expect(response.body.rows).toHaveLength(18);
    const bitcoin = response.body.rows.find((row: { pair: string }) => row.pair === 'BTC-IDR');
    expect(bitcoin.venues).toHaveLength(3);
    expect(bitcoin.venues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ venue: 'INDODAX', status: 'AVAILABLE' }),
        expect.objectContaining({ venue: 'REKU', status: 'AVAILABLE' }),
        expect.objectContaining({ venue: 'TOKOCRYPTO', status: 'AVAILABLE' }),
      ]),
    );
    expect(bitcoin.venues[0].ticker.lastPrice).toBeDefined();
  });

  it('returns pricing, books, public trades, and aligned OHLC inputs for market detail', async () => {
    const response = await request(app).get('/api/markets/btc-idr').expect(200);
    expect(response.body).toMatchObject({ pair: 'BTC-IDR', interval: '1h' });
    expect(response.body.venues).toHaveLength(3);
    for (const venue of response.body.venues) {
      expect(venue.components).toMatchObject({
        ticker: { status: 'AVAILABLE' },
        orderBook: { status: 'AVAILABLE' },
        trades: { status: 'AVAILABLE' },
        candles: { status: 'AVAILABLE' },
      });
      expect(venue.ticker.lastPrice).toBeDefined();
      expect(venue.orderBook.bids.length).toBeGreaterThan(0);
      expect(venue.orderBook.asks.length).toBeGreaterThan(0);
      expect(venue.trades.length).toBeGreaterThan(0);
      expect(venue.candles).toHaveLength(24);
    }
  });

  it.each([
    ['1d', '1h', 24],
    ['1w', '4h', 42],
    ['1y', '1d', 365],
  ])('returns bounded %s comparative candle history', async (period, interval, count) => {
    const response = await request(app)
      .get(`/api/markets/btc-idr/candles?period=${period}`)
      .expect(200);
    expect(response.body).toMatchObject({ pair: 'BTC-IDR', period, interval });
    expect(response.body.maxBucketsPerVenue).toBe(count);
    expect(Date.parse(response.body.requestedFromAt)).toBeLessThan(
      Date.parse(response.body.requestedToAt),
    );
    expect(Date.parse(response.body.requestedToAt)).toBeLessThanOrEqual(
      Date.parse(response.body.generatedAt),
    );
    expect(response.body.venues).toHaveLength(3);
    for (const venue of response.body.venues) {
      expect(venue).toMatchObject({ status: 'AVAILABLE' });
      expect(venue.candles).toHaveLength(count);
    }
  });

  it('returns all approved weekly history without exceeding its point cap', async () => {
    const response = await request(app).get('/api/markets/btc-idr/candles?period=all').expect(200);
    expect(response.body).toMatchObject({ pair: 'BTC-IDR', period: 'all', interval: '1w' });
    for (const venue of response.body.venues) {
      expect(venue).toMatchObject({ status: 'AVAILABLE' });
      expect(venue.candles.length).toBeGreaterThan(0);
      expect(venue.candles.length).toBeLessThanOrEqual(1000);
    }
  });

  it('defaults candle history to 1d and rejects unknown periods', async () => {
    const response = await request(app).get('/api/markets/btc-idr/candles').expect(200);
    expect(response.body).toMatchObject({ period: '1d', interval: '1h' });
    await request(app).get('/api/markets/btc-idr/candles?period=30d').expect(400);
    await request(app).get('/api/markets/btc-idr/candles?period=1d&period=1w').expect(400);
    await request(app).get('/api/markets/btc-usdt/candles?period=1d').expect(400);
    await request(app).get('/api/markets/nope-idr/candles?period=1d').expect(404);
  });

  it('distinguishes malformed and unavailable market detail pairs', async () => {
    await request(app).get('/api/markets/btc-usdt').expect(400);
    const response = await request(app).get('/api/markets/nope-idr').expect(404);
    expect(response.body.error.code).toBe('MARKET_NOT_FOUND');
  });

  it('rejects invalid and unsupported requests without venue fan-out', async () => {
    await request(app).get('/api/comparisons?asset=BTC&side=buy&amount=-1').expect(400);
    const response = await request(app)
      .get('/api/comparisons?asset=NOPE&side=buy&amount=1')
      .expect(422);
    expect(response.body.error.code).toBe('UNSUPPORTED_INSTRUMENT');
  });

  it('accepts only coarse, non-identifying analytics', async () => {
    await request(app)
      .post('/api/events')
      .send({ event: 'comparison_requested', pair: 'BTC-IDR', side: 'buy', sizeBucket: 'medium' })
      .expect(202);
    await request(app)
      .post('/api/events')
      .send({
        event: 'comparison_requested',
        pair: 'BTC-IDR',
        side: 'buy',
        sizeBucket: 'medium',
        rawAmount: '5000000',
      })
      .expect(202);
  });
});
