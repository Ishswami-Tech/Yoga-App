import { test, expect, type Page } from '@playwright/test';
import { login, nav, apiSignOut, type AccountKey } from './helpers';

const heading = (page: Page, name: string | RegExp) =>
  page.getByRole('heading', { name, level: 1 });

async function todayApi(page: Page) {
  const res = await page.request.get('/api/classes/today');
  return { status: res.status(), body: res.status() === 200 ? await res.json() : null };
}

test.describe('student', () => {
  test('dashboard renders greeting and nav for an active member', async ({ page }) => {
    await login(page, 'priya');
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening|night), Priya/ })).toBeVisible();
    for (const label of ['Today', 'Upcoming', 'Journal', 'Feedback', 'Membership', 'Payments', 'Profile']) {
      await expect(page.locator('aside nav').getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('active member: today page allows joining (never offers subscribe)', async ({ page }) => {
    await login(page, 'priya');
    const api = await todayApi(page);
    await nav(page, 'Today');
    if (api.status === 404) {
      await expect(page.getByText('No class scheduled today')).toBeVisible();
      return;
    }
    expect(api.status).toBe(200);
    expect(api.body.canJoin).toBe(true);
    expect(api.body.membershipRequired).toBeFalsy();
    await expect(heading(page, "Today's class")).toBeVisible();
    await expect(page.getByRole('button', { name: /Subscribe to join/ })).toHaveCount(0);
    if (api.body.meetUrl) {
      await expect(page.getByRole('button', { name: /Join class on Google Meet/ })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: /Meet link not ready yet/ })).toBeDisabled();
    }
  });

  for (const key of ['ananya', 'kabir'] as AccountKey[]) {
    test(`${key} (no/expired membership): join is gated and meet link is withheld`, async ({ page }) => {
      await login(page, key);
      const api = await todayApi(page);
      await nav(page, 'Today');
      if (api.status === 404) {
        await expect(page.getByText('No class scheduled today')).toBeVisible();
        return;
      }
      expect(api.body.canJoin).toBe(false);
      expect(api.body.meetUrl).toBeNull();
      await expect(page.getByRole('button', { name: /Subscribe to join/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Join class on Google Meet/ })).toHaveCount(0);
      await expect(page.getByText("Subscribe to unlock today's class")).toBeVisible();
      // direct join API must be forbidden too
      const join = await page.request.get(`/api/classes/join?classId=${api.body.id}`);
      expect([403, 404]).toContain(join.status());
      expect(await join.text()).not.toMatch(/meet\.google\.com/);
    });
  }

  test('upcoming classes list renders with join state matching membership', async ({ page }) => {
    await login(page, 'priya');
    await nav(page, 'Upcoming');
    await expect(heading(page, 'Upcoming classes')).toBeVisible();
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(page.locator('table').getByText('Members only')).toHaveCount(0);

    // a non-member sees members-only state
    await apiSignOut(page);
    await login(page, 'ananya');
    await nav(page, 'Upcoming');
    await expect(heading(page, 'Upcoming classes')).toBeVisible();
    await expect(page.locator('table').getByText('Members only').first()).toBeVisible();
  });

  test('membership and payments pages reflect membership state', async ({ page }) => {
    await login(page, 'priya');
    await nav(page, 'Membership');
    await expect(heading(page, 'Membership')).toBeVisible();
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
    await nav(page, 'Payments');
    await expect(page.getByRole('heading', { name: 'Payments' }).first()).toBeVisible();

    await apiSignOut(page);
    await login(page, 'kabir');
    await nav(page, 'Membership');
    await expect(heading(page, 'Membership')).toBeVisible();
    await expect(page.getByText('Expired', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Renew ₹1,500\/month/ })).toBeVisible();

    await apiSignOut(page);
    await login(page, 'ananya');
    await nav(page, 'Membership');
    await expect(page.getByRole('button', { name: /Subscribe ₹1,500\/month/ }).first()).toBeVisible();
    await nav(page, 'Payments');
    await expect(page.getByText('No payments yet')).toBeVisible();
  });

  test('profile edit persists across reload, then is restored', async ({ page }) => {
    await login(page, 'priya');
    await nav(page, 'Profile');
    await expect(heading(page, 'Profile')).toBeVisible();
    const phone = page.getByLabel('Phone');
    await expect(phone).toBeVisible();
    const original = await phone.inputValue();
    const next = `+91 9${String(Date.now()).slice(-9)}`;
    try {
      await phone.fill(next);
      await page.getByRole('button', { name: /Save changes/ }).click();
      await expect(page.getByText('Profile updated')).toBeVisible();
      await page.reload();
      await nav(page, 'Profile');
      await expect(page.getByLabel('Phone')).toHaveValue(next);
      const prof = await (await page.request.get('/api/profile')).json();
      expect(prof.phone).toBe(next);
    } finally {
      const cur = await (await page.request.get('/api/profile')).json();
      const res = await page.request.patch('/api/profile', { data: { name: cur.name, phone: original || null } });
      expect(res.ok()).toBeTruthy();
    }
    await page.reload();
    await nav(page, 'Profile');
    await expect(page.getByLabel('Phone')).toHaveValue(original);
  });

  test('profile rejects clearing the name', async ({ page }) => {
    await login(page, 'priya');
    await nav(page, 'Profile');
    const name = page.getByLabel('Full name');
    const original = await name.inputValue();
    await name.fill('');
    await page.getByRole('button', { name: /Save changes/ }).click();
    await page.waitForTimeout(800);
    const prof = await (await page.request.get('/api/profile')).json();
    expect(prof.name).toBe(original);
  });
});
