import { test, expect } from '@playwright/test';

test.describe('Twenty-Nine UI', () => {
  test('lobby renders and starts local match', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Twenty-Nine' })).toBeVisible();
    await page.getByTestId('start-local').click();
    // Should enter game — felt table / phase visible
    await expect(page.getByText(/Bidding|TrumpSelection|Playing|Deal/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('can pass or bid when it is human turn', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-local').click();
    // Wait for bid dialog or playing state
    const pass = page.getByRole('button', { name: 'Pass' });
    const next = page.getByRole('button', { name: 'Next round' });
    // AI may bid through quickly; poll for actionable UI
    await expect(pass.or(page.getByText('Choose trump')).or(next).or(page.getByText('your turn'))).toBeVisible({
      timeout: 15000,
    });
  });
});
