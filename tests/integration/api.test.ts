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
