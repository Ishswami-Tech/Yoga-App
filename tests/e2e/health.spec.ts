import { test, expect } from '@playwright/test';
import { login, nav, collectProblems, type AccountKey } from './helpers';

const roleNav: Record<string, { key: AccountKey; items: string[] }> = {
  admin: {
    key: 'admin',
    items: [
      'Dashboard', 'Students', 'Instructors', 'Subscriptions', 'Payments', 'Schedules', 'Calendar',
      'Exceptions', 'Classes', 'WhatsApp Logs', 'Bulk Message', 'Analytics', 'Audit Log', 'Settings',
    ],
  },
  instructor: { key: 'instructor', items: ['Dashboard', "Today's Roster", 'Schedule', 'Class History'] },
  'student (active)': {
    key: 'priya',
    items: ['Dashboard', 'Today', 'Upcoming', 'Journal', 'Feedback', 'Membership', 'Payments', 'Profile'],
  },
  'student (no membership)': {
    key: 'ananya',
    items: ['Dashboard', 'Today', 'Upcoming', 'Journal', 'Feedback', 'Membership', 'Payments', 'Profile'],
  },
  'student (expired)': {
    key: 'kabir',
    items: ['Dashboard', 'Today', 'Upcoming', 'Journal', 'Feedback', 'Membership', 'Payments', 'Profile'],
  },
};

test.describe('console + network health on every main page', () => {
  for (const [role, { key, items }] of Object.entries(roleNav)) {
    test(`${role}: no console errors or 5xx across all pages`, async ({ page }) => {
      const problems = collectProblems(page);
      await login(page, key);
      const perPage: Record<string, { console: string[]; failed: string[] }> = {};
      for (const label of items) {
        const c0 = problems.console.length;
        const f0 = problems.failed.length;
        await nav(page, label);
        await expect(page.locator('main h1, main h2, main p').first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        perPage[label] = {
          console: problems.console.slice(c0),
          failed: problems.failed.slice(f0),
        };
      }
      problems.stop();
      const offenders = Object.fromEntries(
        Object.entries(perPage).filter(([, v]) => v.console.length || v.failed.length),
      );
      expect(offenders, 'pages with console errors / failed requests').toEqual({});
    });
  }
});
