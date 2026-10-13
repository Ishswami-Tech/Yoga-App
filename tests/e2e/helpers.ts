import { expect, type Page, type Response } from '@playwright/test';

import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Sign-in is WhatsApp OTP only. Tests cannot read the WhatsApp message, so they
// plant a known OtpCode row (same HMAC scheme as src/lib/providers/otp.ts).
// Needs DATABASE_URL and AUTH_SECRET in the test environment, matching the server.
const db = new PrismaClient();

export const OTP_CODE = '123456';
// Seeded accounts (prisma/seed.ts) identified by WhatsApp number (10 digits after +91).
export const ACCOUNTS = {
  admin: { phone: '9000000001', home: /Admin console/i },
  instructor: { phone: '9000000002', home: /Good (morning|afternoon|evening)|Namaste|Welcome|Hello/i },
  priya: { phone: '9000000010', home: /Good (morning|afternoon|evening)|Namaste|Welcome|Hello/i },
  ananya: { phone: '9000000012', home: /Good (morning|afternoon|evening)|Namaste|Welcome|Hello/i },
  kabir: { phone: '9000000013', home: /Good (morning|afternoon|evening)|Namaste|Welcome|Hello/i },
} as const;
export type AccountKey = keyof typeof ACCOUNTS;

export async function plantOtp(tenDigits: string, purpose: 'LOGIN' | 'REGISTER' = 'LOGIN') {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET must be set for e2e tests');
  const digits = `91${tenDigits}`;
  await db.otpCode.updateMany({ where: { phone: digits, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.otpCode.create({
    data: {
      phone: digits,
      codeHash: createHmac('sha256', secret).update(`otp:${digits}:${OTP_CODE}`).digest('hex'),
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
}

/** Fresh unique 10-digit test number (prefix 700 so api/cleanup.ts removes it). */
export function testNumber() {
  return `700${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
}

/**
 * Log in through the real UI modal. WhatsApp delivery is stubbed at the network
 * layer (no real message is sent from tests) and the code is planted in the DB.
 */
export async function loginViaUI(page: Page, phone: string, code = OTP_CODE) {
  await page.route('**/api/auth/otp/send', async (route) => {
    await plantOtp(phone);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Log in' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('WhatsApp number').fill(phone);
  await dialog.getByRole('button', { name: /Send code on WhatsApp/ }).click();
  await dialog.getByLabel('6-digit code').fill(code);
}

/** Fast login: plant a code and verify through the API, then load the app signed in. */
export async function login(page: Page, key: AccountKey) {
  await plantOtp(ACCOUNTS[key].phone);
  const res = await page.request.post('/api/auth/otp/verify', {
    data: { phone: `+91${ACCOUNTS[key].phone}`, code: OTP_CODE },
  });
  expect(res.ok(), `otp verify for ${key} -> ${res.status()}`).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(0);
  await expect(page.locator('aside nav')).toBeVisible();
}

export async function nav(page: Page, label: string) {
  await page.locator('aside nav').getByRole('button', { name: label, exact: true }).click();
}

export async function signOut(page: Page) {
  await page.locator('header').getByRole('button').filter({ has: page.locator('span.rounded-full') }).last().click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
}

export type Problems = { console: string[]; failed: string[]; stop: () => void };

/** Collect console errors, uncaught page errors, and 5xx / failed requests. */
export function collectProblems(page: Page): Problems {
  const consoleErrors: string[] = [];
  const failed: string[] = [];
  const onConsole = (m: any) => {
    if (m.type() === 'error') {
      const loc = m.location?.()?.url ?? '';
      consoleErrors.push(`${m.text()} ${loc}`.trim());
    }
  };
  const onPageError = (e: Error) => consoleErrors.push(`pageerror: ${e.message}`);
  const onResponse = (r: Response) => {
    if (r.status() >= 500) failed.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  };
  const onFailed = (r: any) => {
    const f = r.failure()?.errorText ?? '';
    if (/ABORTED/i.test(f)) return; // navigation/unmount cancellations
    failed.push(`FAILED ${r.method()} ${r.url()} ${f}`);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  page.on('requestfailed', onFailed);
  return {
    console: consoleErrors,
    failed,
    stop: () => {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('response', onResponse);
      page.off('requestfailed', onFailed);
    },
  };
}

export function uniq(prefix = 'e2e') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function apiSignOut(page: Page) {
  const res = await page.request.post('/api/auth/logout', {
    data: {},
    headers: { origin: 'http://localhost:3000' },
  });
  expect(res.ok(), `sign-out -> ${res.status()}`).toBeTruthy();
}
