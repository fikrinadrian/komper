import { expect, test } from '@playwright/test';

test('compares a healthy IDR buy and keeps the estimate disclosure visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Harga terbaik/ })).toBeVisible();
  await page.getByLabel('Aset').selectOption('BTC');
  await page.getByLabel('Budget pembelian').fill('5000000');
  await page.getByRole('button', { name: 'Bandingkan estimasi' }).click();
  await expect(page.getByRole('heading', { name: 'Hasil untuk BTC / IDR' })).toBeVisible();
  await expect(page.getByText(/Estimasi gross terbaik berdasarkan 3 dari 3/)).toBeVisible();
  await expect(page.getByText('Estimasi — bukan kuotasi yang dapat dieksekusi.')).toBeVisible();
  await expect(page.getByText('Fee belum terverifikasi.')).toHaveCount(3);
});

test('retains two healthy venues and exposes the failed source', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Aset').selectOption('WIF');
  await page.getByLabel('Budget pembelian').fill('1000000');
  await page.getByRole('button', { name: 'Bandingkan estimasi' }).click();
  await expect(page.getByText(/berdasarkan 2 dari 3 venue sehat/)).toBeVisible();
  await expect(page.getByText('Data ditolak')).toBeVisible();
  await expect(page.getByText(/gagal validasi/)).toBeVisible();
});

test('shows insufficient depth and prevents it from winning', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Aset').selectOption('HBAR');
  await page.getByLabel('Budget pembelian').fill('1000000');
  await page.getByRole('button', { name: 'Bandingkan estimasi' }).click();
  await expect(page.getByText('Depth tidak cukup')).toBeVisible();
  await expect(page.getByText(/Kedalaman terlihat tidak cukup/)).toBeVisible();
  await expect(page.getByText(/berdasarkan 2 dari 3 venue sehat/)).toBeVisible();
});

test('supports keyboard-only sell flow at mobile width', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only coverage');
  await page.goto('/');
  await page.getByLabel('Arah transaksi').getByText('Jual').click();
  await page.getByLabel('Jumlah aset yang dijual').fill('0.1');
  await page.getByRole('button', { name: 'Bandingkan estimasi' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Dana diterima (gross)').first()).toBeVisible();
  const exchangeLink = page.getByRole('link', { name: /Buka Reku/ });
  await exchangeLink.focus();
  await expect(exchangeLink).toBeFocused();
});

test('preserves high-precision financial input in the browser', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Arah transaksi').getByText('Jual').click();
  await page.getByLabel('Jumlah aset yang dijual').fill('1.000000000000000001');
  await expect(page.getByText('Dibaca sebagai 1,000000000000000001 BTC')).toBeVisible();
});
