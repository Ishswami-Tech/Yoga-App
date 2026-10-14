import { test, expect, type Page } from '@playwright/test';
import { uniq, plantOtp, testNumber, OTP_CODE, apiSignOut } from './helpers';

/** Log in with a brand-new number through the single modal; stops at the profile dialog. */
async function signInAsNewUser(page: Page, phone: string) {
  // WhatsApp delivery is stubbed; the code is planted in the DB for the unknown number.
  await page.route('**/api/auth/otp/send', async (route) => {
    await plantOtp(phone, 'REGISTER');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Full name')).toHaveCount(0);
  await dialog.getByLabel('WhatsApp number').fill(phone);
  await dialog.getByRole('button', { name: /Send code on WhatsApp/ }).click();
  await dialog.getByLabel('6-digit code').fill(OTP_CODE);
  await expect(page.getByRole('heading', { name: 'Complete your profile' })).toBeVisible();
}

test.describe('registration (single WhatsApp sign-in flow)', () => {
  test('a brand-new number must complete the profile dialog, then lands on the student dashboard', async ({ page }) => {
    const id = uniq('newstu');
    const name = `E2E ${id}`;
    const phone = testNumber();
    await signInAsNewUser(page, phone);

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill(name);
    await dialog.getByLabel('Email').fill(`${id}@example.com`);
    const submit = dialog.getByRole('button', { name: /Save and continue/ });
    await expect(submit).toBeDisabled(); // terms not accepted yet
    await dialog.getByRole('checkbox').check();
    await submit.click();

    await expect(page.getByRole('heading', { name: 'Complete your profile' })).toHaveCount(0);
    await expect(page.locator('header').getByText('Student portal', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening|night), E2E/ })).toBeVisible();

    // The profile survives a reload: no dialog again.
    await page.reload();
    await expect(page.locator('header').getByText('Student portal', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Complete your profile' })).toHaveCount(0);
    const me = await (await page.request.get('/api/auth/me')).json();
    expect(me.user.role).toBe('STUDENT');
    expect(me.user.profileCompleted).toBe(true);
    expect(me.user.whatsappNumber).toBe(`+91${phone}`);
    expect(me.membership?.hasActive ?? false).toBe(false);

    await apiSignOut(page);
  });

  test('the profile dialog cannot be dismissed with Escape and returns after a reload', async ({ page }) => {
    await signInAsNewUser(page, testNumber());
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Complete your profile' })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Close' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Complete your profile' })).toBeVisible();
    await expect(page.locator('aside nav')).toHaveCount(0);
    await apiSignOut(page);
  });

  test('sign-in needs a valid WhatsApp number before a code can be sent', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Get started' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /Send code on WhatsApp/ })).toBeDisabled();
    await dialog.getByLabel('WhatsApp number').fill(testNumber());
    await expect(dialog.getByRole('button', { name: /Send code on WhatsApp/ })).toBeEnabled();
  });

  test('registration cannot self-assign ADMIN role', async ({ request }) => {
    const phone = testNumber();
    await plantOtp(phone, 'REGISTER');
    const res = await request.post('/api/auth/otp/verify', {
      data: { phone: `+91${phone}`, code: OTP_CODE, role: 'ADMIN' },
    });
    expect(res.ok()).toBeTruthy();
    const me = await (await request.get('/api/auth/me')).json();
    expect(me.user?.role).toBe('STUDENT');
  });
});
