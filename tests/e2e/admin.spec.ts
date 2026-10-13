import { test, expect } from '@playwright/test';
import { login, nav, collectProblems } from './helpers';

const pages: [string, string | RegExp][] = [
  ['Dashboard', 'Admin console'],
  ['Students', 'Students'],
  ['Instructors', 'Instructors'],
  ['Subscriptions', 'Subscriptions'],
  ['Payments', 'Payments'],
  ['Schedules', 'Schedules'],
  ['Calendar', 'Schedule calendar'],
  ['Exceptions', 'Exceptions'],
  ['Classes', 'Generated classes'],
  ['WhatsApp Logs', 'WhatsApp logs'],
  ['Bulk Message', 'Bulk message'],
  ['Analytics', 'Analytics'],
  ['Audit Log', 'Audit log'],
  ['Settings', 'Settings'],
];

test.describe('admin', () => {
  for (const [label, title] of pages) {
    test(`${label} page renders without console errors or 5xx`, async ({ page }) => {
      await login(page, 'admin');
      const problems = collectProblems(page);
      await nav(page, label);
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
      await expect(page.locator('main')).not.toContainText(/Something went wrong|Couldn't load/i);
      await page.waitForLoadState('networkidle');
      problems.stop();
      expect(problems.failed, 'failed/5xx requests').toEqual([]);
      expect(problems.console, 'console errors').toEqual([]);
    });
  }

  test('students list shows seeded students and search narrows it', async ({ page }) => {
    await login(page, 'admin');
    await nav(page, 'Students');
    await expect(page.getByText('priya@student.demo').first()).toBeVisible();
    await expect(page.getByText('kabir@student.demo').first()).toBeVisible();
    const search = page.getByPlaceholder(/search/i).first();
    await search.fill('ananya');
    await expect(page.getByText('ananya@student.demo').first()).toBeVisible();
    await expect(page.getByText('kabir@student.demo')).toHaveCount(0);
  });

  test('users API returns the seeded accounts for admin', async ({ page }) => {
    await login(page, 'admin');
    const res = await page.request.get('/api/admin/users');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('admin@yoga.demo');
    expect(text).not.toMatch(/passwordHash|"password"/);
  });
});
