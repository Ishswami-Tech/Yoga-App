import { test, expect, type Page } from '@playwright/test';
import { uniq, plantOtp, testNumber, OTP_CODE, apiSignOut } from './helpers';

/** Log in with a brand-new number through the single modal; stops at the profile dialog. */
async function stubMethods(page: Page, methods = { phone: true, email: true, google: true }) {
  await page.route('**/api/auth/methods', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(methods) })
  );
}

async function signInAsNewUser(page: Page, phone: string, methods = { phone: true, email: true, google: true }) {
  await stubMethods(page, methods);
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

test.describe('registration (single sign-in flow)', () => {
  test('the modal offers Phone by default, Email and Google when enabled', async ({ page }) => {
    await stubMethods(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Get started' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('tab', { name: 'Phone' })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByLabel('WhatsApp number')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Sign in with Google/ })).toBeVisible();
    await expect(dialog.getByText("New here? We'll create your account for you.")).toBeVisible();
    await dialog.getByRole('tab', { name: 'Email' }).click();
    await expect(dialog.getByLabel('Email address')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Send email code/ })).toBeDisabled();
    await dialog.getByLabel('Email address').fill('someone@example.com');
    await expect(dialog.getByRole('button', { name: /Send email code/ })).toBeEnabled();
  });

  test('Email tab and Google button are hidden when the methods endpoint disables them', async ({ page }) => {
    await stubMethods(page, { phone: true, email: false, google: false });
    await page.goto('/');
    await page.getByRole('button', { name: 'Get started' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('WhatsApp number')).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Email' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /Sign in with Google/ })).toHaveCount(0);
  });

  test('a brand-new number must complete the profile dialog, then lands on the student dashboard', async ({ page }) => {
    const id = uniq('newstu');
    const name = `E2E ${id}`;
    const phone = testNumber();
    // Email delivery off: the simple unverified email field is the fallback.
    await signInAsNewUser(page, phone, { phone: true, email: false, google: false });

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill(name);
    await dialog.getByLabel('Email').fill(`${id}@example.com`);
    const submit = dialog.getByRole('button', { name: /^Finish$/ });
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

  test('with email codes enabled the profile dialog verifies the email before continuing', async ({ page }) => {
    const email = `${uniq('verify')}@example.com`;
    await page.route('**/api/profile/email/send', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    );
    await page.route('**/api/profile/email/verify', async (route) => {
      const me = await (await page.request.get('/api/auth/me')).json();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { ...me.user, email, emailVerified: true, emailIsPlaceholder: false } }),
      });
    });
    await signInAsNewUser(page, testNumber());
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('E2E Verify');
    await expect(dialog.getByRole('button', { name: /^Continue$/ })).toBeDisabled();
    await dialog.getByLabel('Email', { exact: true }).fill(email);
    await dialog.getByRole('button', { name: 'Send code' }).click();
    await dialog.getByLabel('6-digit code').fill(OTP_CODE);
    await expect(dialog.getByText('Email verified')).toBeVisible();
    await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue(email);
    await expect(dialog.getByRole('button', { name: /^Continue$/ })).toBeEnabled();
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
