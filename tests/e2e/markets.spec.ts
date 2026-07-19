import { expect, test } from '@playwright/test';

test('finds a pair, compares venue prices, and opens the canonical detail route', async ({
  page,
}) => {
  await page.goto('/markets');
  await expect(page.getByRole('heading', { name: 'Harga terakhir, berdampingan.' })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Cari pair' }).fill('BTC');
  const bitcoinRow = page
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'BTC/IDR' }) });
  await expect(bitcoinRow).toBeVisible();
  await expect(bitcoinRow.getByText(/Rp1\.000\.000\.000/)).toHaveCount(1);
  await expect(bitcoinRow.getByText(/Usia ·/)).toHaveCount(3);

  await bitcoinRow.getByRole('link', { name: 'BTC/IDR' }).click();
  await expect(page).toHaveURL(/\/markets\/btc-idr$/);
  await expect(page.getByRole('heading', { name: 'BTC/IDR', level: 1 })).toBeVisible();
  await expect(page.getByRole('table', { name: /pricing dan ticker/ })).toBeVisible();
  await expect(
    page.getByRole('region', {
      name: 'Perbandingan harga close BTC/IDR per exchange. Highcharts interactive chart.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '1D' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Timeframe 1D · interval candle 1h/)).toBeVisible();
  for (const timeframe of [
    { button: '1W', period: '1w', interval: '4h' },
    { button: '1Y', period: '1y', interval: '1d' },
    { button: 'All', period: 'all', interval: '1w' },
  ]) {
    const response = page.waitForResponse(
      (candidate) =>
        candidate.url().includes(`/api/markets/btc-idr/candles?period=${timeframe.period}`) &&
        candidate.ok(),
    );
    await page.getByRole('button', { name: timeframe.button, exact: true }).click();
    await response;
    await expect(page.getByRole('button', { name: timeframe.button, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByText(
        new RegExp(
          `Timeframe ${timeframe.period.toUpperCase()} · interval candle ${timeframe.interval}`,
        ),
      ),
    ).toBeVisible();
  }
  await page.getByText('Data grafik aksesibel').click();
  await expect(
    page.getByRole('table', { name: /Harga OHLC Indodax, Reku, dan Tokocrypto/ }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order book per exchange' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Volume 24 jam dan public trades' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OHLC terbaru per exchange' })).toBeVisible();
});

test('canonicalizes uppercase pair paths and rejects malformed market routes without API detail', async ({
  page,
}) => {
  await page.goto('/markets/BTC-IDR');
  await expect(page).toHaveURL(/\/markets\/btc-idr$/);
  await expect(page.getByRole('heading', { name: 'BTC/IDR', level: 1 })).toBeVisible();

  let malformedDetailRequested = false;
  let unsupportedDetailRequested = false;
  page.on('request', (request) => {
    if (request.url().includes('/api/markets/btc_usdt')) malformedDetailRequested = true;
    if (request.url().includes('/api/markets/nope-idr')) unsupportedDetailRequested = true;
  });
  await page.goto('/markets/btc_usdt');
  await expect(page.getByRole('heading', { name: 'Route market tidak valid' })).toBeVisible();
  expect(malformedDetailRequested).toBe(false);

  await page.goto('/markets/nope-idr');
  await expect(page.getByRole('heading', { name: 'NOPE/IDR belum tersedia' })).toBeVisible();
  expect(unsupportedDetailRequested).toBe(false);
});

test('keeps the last successful chart when a new timeframe fails', async ({ page }) => {
  await page.route('**/api/markets/btc-idr/candles?period=1y', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Riwayat 1Y sedang tidak tersedia.' },
      }),
    });
  });
  await page.goto('/markets/btc-idr');
  await expect(page.getByText(/Timeframe 1D · interval candle 1h/)).toBeVisible();

  await page.getByRole('button', { name: '1Y', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Data market gagal dimuat' })).toBeVisible();
  await expect(page.getByText(/Grafik 1D terakhir tetap ditampilkan/)).toBeVisible();
  await expect(page.getByText(/Timeframe 1D · interval candle 1h/)).toBeVisible();
  await expect(page.getByRole('button', { name: '1Y', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('retries a partial aggregate snapshot without hiding healthy pricing', async ({ page }) => {
  let detailCalls = 0;
  await page.route('**/api/markets/btc-idr', async (route) => {
    detailCalls += 1;
    const response = await route.fetch();
    const payload = await response.json();
    if (detailCalls === 1) {
      const reku = payload.venues.find((venue: { venue: string }) => venue.venue === 'REKU');
      reku.orderBook = undefined;
      reku.reason = 'Komponen tidak tersedia: order book.';
      reku.components.orderBook = {
        status: 'UNAVAILABLE',
        reason: 'Order book tidak tersedia.',
      };
    }
    await route.fulfill({ response, json: payload });
  });

  await page.goto('/markets/btc-idr');
  await expect(page.getByText('Data parsial.')).toBeVisible();
  await expect(page.getByRole('table', { name: /pricing dan ticker/ })).toBeVisible();
  await page.getByRole('button', { name: 'Muat ulang snapshot' }).click();
  await expect.poll(() => detailCalls).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('Data parsial.')).toHaveCount(0);
});

test('market search exposes a clear empty result at mobile width', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only coverage');
  await page.goto('/markets');
  await page.getByRole('searchbox', { name: 'Cari pair' }).fill('ZZZZ-NOT-FOUND');
  await expect(page.getByText('Pair yang cocok tidak ditemukan.')).toBeVisible();
});
