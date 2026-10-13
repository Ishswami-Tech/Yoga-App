import { test, expect } from '@playwright/test';
import { login, nav } from './helpers';

test.describe('instructor', () => {
  test('dashboard, schedule and history render', async ({ page }) => {
    await login(page, 'instructor');
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening|night), / })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Today's classes" })).toBeVisible();
    await nav(page, 'Schedule');
    await expect(page.locator('main')).not.toContainText(/Something went wrong/);
    await nav(page, 'Class History');
    await expect(page.getByRole('heading', { name: 'Class history', level: 1 }).or(page.getByText('No class history yet'))).toBeVisible();
  });

  test("today's roster lists active members; attendance can be marked and restored", async ({ page }) => {
    await login(page, 'instructor');
    const api = await (await page.request.get('/api/instructor/classes')).json();
    await nav(page, "Today's Roster");
    await expect(page.getByRole('heading', { name: "Today's roster", level: 1 })).toBeVisible();

    if (api.today.length === 0) {
      await expect(page.getByText('No classes scheduled today')).toBeVisible();
      return;
    }
    const classId: string = api.today[0].id;
    const attendanceUrl = `/api/instructor/classes/${classId}/attendance`;
    await expect(page.getByText('Active members')).toBeVisible();
    await expect(page.getByText('priya@student.demo')).toBeVisible();

    const before = await (await page.request.get(attendanceUrl)).json();
    const target = before.roster[0];
    const wasAttended: boolean = target.attended;
    const expected = before.attendedCount + (wasAttended ? -1 : 1);

    await page.getByRole('button', { name: /Record attendance/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/\d+ \/ \d+ attended/)).toBeVisible();
    try {
      await dialog.getByRole('button', { name: new RegExp(target.studentEmail.replace(/\./g, '\\.')) }).click();
      await expect
        .poll(async () => {
          const r = await (await page.request.get(attendanceUrl)).json();
          return r.roster.find((x: any) => x.userId === target.userId).attended;
        })
        .toBe(!wasAttended);
      await expect(dialog.getByText(new RegExp(`^${expected} / `))).toBeVisible();
      await dialog.getByRole('button', { name: 'Done' }).click();
      await page.reload();
      await nav(page, "Today's Roster");
      await expect(page.getByText('Attended', { exact: true }).locator('xpath=preceding-sibling::p[1]')).toHaveText(String(expected));
    } finally {
      const r = await (await page.request.get(attendanceUrl)).json();
      const cur = r.roster.find((x: any) => x.userId === target.userId).attended;
      if (cur !== wasAttended) {
        if (wasAttended) {
          await page.request.post(attendanceUrl, { data: { userIds: [target.userId] } });
        } else {
          await page.request.delete(`${attendanceUrl}/${target.userId}`);
        }
      }
    }
    const after = await (await page.request.get(attendanceUrl)).json();
    expect(after.attendedCount).toBe(before.attendedCount);
  });

  test('instructor cannot reach admin APIs', async ({ page }) => {
    await login(page, 'instructor');
    const res = await page.request.get('/api/admin/users');
    expect([401, 403]).toContain(res.status());
  });
});
