import { expect, test } from '@playwright/test';

test('foundation explains scope and supports keyboard navigation', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Equipment Booking');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByLabel('Project status')).toContainText(
    'still to be built',
  );
  await expect(page.getByText('Browser time zone:')).toContainText(
    'Asia/Bangkok',
  );
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath('foundation.png'),
    fullPage: true,
  });
});

test('connection check announces API liveness', async ({ page }) => {
  await page.route('**/api/v1/health', (route) =>
    route.fulfill({ json: { status: 'ok' } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.getByRole('status')).toHaveText('API is online');
});

test('connection failure is recoverable without a false success', async ({
  page,
}) => {
  await page.route('**/api/v1/health', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.getByRole('status')).toContainText('API unavailable');
  await expect(
    page.getByRole('button', { name: 'Check connection' }),
  ).toBeEnabled();
});
