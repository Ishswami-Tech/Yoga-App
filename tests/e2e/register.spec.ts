import { test, expect } from '@playwright/test';
import { uniq, plantOtp, testNumber, OTP_CODE, apiSignOut } from './helpers';

test.describe('registration', () => {
  test('a brand-new student can register with a WhatsApp code and lands on the student dashboard', async ({ page }) => {
    const id = uniq('newstu');
    const name = `E2E ${id}`;
    const phone = testNumber();

    // WhatsApp delivery is stubbed; the code is planted in the DB.
    await page.route('**/api/auth/otp/send', async (route) => {
      await plantOtp(phone, 'REGISTER');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Get started' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill(name);
    await dialog.getByLabel('WhatsApp number').fill(phone);
    await dialog.getByRole('button', { name: /Send code on WhatsApp/ }).click();
    await dialog.getByLabel('6-digit code').fill(OTP_CODE);

    await expect(page.locator('header').getByText('Student portal', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening|night), E2E/ })).toBeVisible();

    await page.reload();
    await expect(page.locator('header').getByText('Student portal', { exact: true })).toBeVisible();
    const me = await (await page.request.get('/api/auth/me')).json();
    expect(me.user.role).toBe('STUDENT');
    expect(me.user.whatsappNumber).toBe(`+91${phone}`);
    expect(me.membership?.hasActive ?? false).toBe(false);

    const today = await page.request.get('/api/classes/today');
    if (today.status() === 200) expect((await today.json()).meetUrl).toBeNull();

    await apiSignOut(page);
  });

  test('register needs a name before a code can be sent', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Get started' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('WhatsApp number').fill(testNumber());
    await expect(dialog.getByRole('button', { name: /Send code on WhatsApp/ })).toBeDisabled();
  });

  test('registration cannot self-assign ADMIN role', async ({ request }) => {
    const phone = testNumber();
    await plantOtp(phone, 'REGISTER');
    const res = await request.post('/api/auth/otp/verify', {
      data: { phone: `+91${phone}`, code: OTP_CODE, mode: 'register', name: 'Evil', role: 'ADMIN' },
    });
    expect(res.ok()).toBeTruthy();
    const me = await (await request.get('/api/auth/me')).json();
    expect(me.user?.role).toBe('STUDENT');
  });
});
