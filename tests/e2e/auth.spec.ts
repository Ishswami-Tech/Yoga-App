import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginViaUI, signOut, type AccountKey } from './helpers';

const roles: [AccountKey, string][] = [
  ['admin', 'Admin console'],
  ['instructor', 'Instructor workspace'],
  ['priya', 'Student portal'],
];

test.describe('auth', () => {
  for (const [key, portal] of roles) {
    test(`login lands on the ${key} dashboard`, async ({ page }) => {
      await loginViaUI(page, ACCOUNTS[key].phone);
      await expect(page.locator('header').getByText(portal, { exact: true })).toBeVisible();
      await expect(page.locator('aside nav').getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: ACCOUNTS[key].home })).toBeVisible();
      // session persists across reload
      await page.reload();
      await expect(page.locator('header').getByText(portal, { exact: true })).toBeVisible();
    });
  }

  test('other student accounts (no / expired membership) can log in', async ({ page }) => {
    await loginViaUI(page, ACCOUNTS.ananya.phone);
    await expect(page.locator('header').getByText('Student portal', { exact: true })).toBeVisible();
  });

  test('wrong code is rejected with an error', async ({ page }) => {
    await loginViaUI(page, ACCOUNTS.priya.phone, '000000');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('aside nav')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible();
  });

  test('the modal has no password, email or Google sign-in', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('WhatsApp number')).toBeVisible();
    await expect(dialog.getByLabel(/password/i)).toHaveCount(0);
    await expect(dialog.getByText(/google/i)).toHaveCount(0);
  });

  test('sign out returns to landing and a reload stays signed out', async ({ page }) => {
    await loginViaUI(page, ACCOUNTS.priya.phone);
    await expect(page.locator('aside nav')).toBeVisible();
    await signOut(page);
    await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible();
    await expect(page.locator('aside nav')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible();
    await expect(page.locator('aside nav')).toHaveCount(0);
    const me = await page.request.get('/api/auth/me');
    expect((await me.json()).user ?? null).toBeNull();
  });

  test('unauthenticated /api/admin/users is rejected', async ({ request }) => {
    const res = await request.get('/api/admin/users');
    expect([401, 403]).toContain(res.status());
  });

  test('student session cannot read /api/admin/users', async ({ page }) => {
    await loginViaUI(page, ACCOUNTS.priya.phone);
    await expect(page.locator('aside nav')).toBeVisible();
    const res = await page.request.get('/api/admin/users');
    expect([401, 403]).toContain(res.status());
  });
});
