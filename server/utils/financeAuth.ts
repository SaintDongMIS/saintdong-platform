import { createHmac, timingSafeEqual } from 'node:crypto';
import type { H3Event } from 'h3';

export const FINANCE_SESSION_COOKIE = 'finance_session';
export const FINANCE_SESSION_MAX_AGE_SEC = 8 * 60 * 60;

export const FINANCE_ALLOWED_USERS = ['Jim', 'Sam', 'Finance'] as const;
export type FinanceUser = (typeof FINANCE_ALLOWED_USERS)[number];

export function isFinanceAllowedUser(username: string): username is FinanceUser {
  return (FINANCE_ALLOWED_USERS as readonly string[]).includes(username);
}

export function isFinanceProtectedApiPath(pathname: string): boolean {
  const path = pathname.split('?')[0];
  return (
    path.startsWith('/api/finance/') ||
    path.startsWith('/api/bank-convert') ||
    path.startsWith('/api/bank-adhoc') ||
    path.startsWith('/api/bank-wire-export-log') ||
    path.startsWith('/api/upload/finance') ||
    path === '/api/process-excel'
  );
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function verifyFinanceCredentials(
  username: string,
  password: string,
  expectedPassword: string,
): boolean {
  if (!expectedPassword) return false;
  const trimmed = username.trim();
  if (!isFinanceAllowedUser(trimmed)) return false;
  return safeEqualString(password, expectedPassword);
}

export function createFinanceSessionToken(
  username: FinanceUser,
  secret: string,
  now = Date.now(),
): string {
  const expiresAt = now + FINANCE_SESSION_MAX_AGE_SEC * 1000;
  const payload = `${username}|${expiresAt}`;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}|${sig}`;
}

export function parseFinanceSessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): FinanceUser | null {
  if (!secret || !token) return null;

  const parts = token.split('|');
  if (parts.length !== 3) return null;

  const [username, expiresRaw, sig] = parts;
  if (!isFinanceAllowedUser(username)) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  const payload = `${username}|${expiresAt}`;
  const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqualString(sig, expectedSig)) return null;

  return username;
}

export function getFinanceAuthSecrets() {
  return {
    password: process.env.FINANCE_PASSWORD ?? '',
    secret: process.env.FINANCE_SESSION_SECRET ?? '',
  };
}

/** HTTP 內網（如 NAS :3000）不可設 Secure cookie；HTTPS 反代可設 x-forwarded-proto 或 FINANCE_COOKIE_SECURE=true */
export function financeCookieSecure(event?: H3Event): boolean {
  const raw = process.env.FINANCE_COOKIE_SECURE?.toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  if (event) {
    const forwarded = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim();
    if (forwarded === 'https') return true;
  }
  return false;
}

function financeSessionCookieOptions(event: H3Event) {
  return {
    httpOnly: true,
    secure: financeCookieSecure(event),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: FINANCE_SESSION_MAX_AGE_SEC,
  };
}

export function getFinanceUserFromEvent(event: H3Event): FinanceUser | null {
  const { secret } = getFinanceAuthSecrets();
  if (!secret) return null;

  const token = getCookie(event, FINANCE_SESSION_COOKIE);
  if (!token) return null;

  return parseFinanceSessionToken(token, secret);
}

export function setFinanceSessionCookie(event: H3Event, username: FinanceUser) {
  const { secret } = getFinanceAuthSecrets();
  if (!secret) {
    throw createError({
      statusCode: 503,
      statusMessage: '財務登入尚未設定（缺少 FINANCE_SESSION_SECRET）',
    });
  }

  const token = createFinanceSessionToken(username, secret);
  setCookie(event, FINANCE_SESSION_COOKIE, token, financeSessionCookieOptions(event));
}

export function clearFinanceSessionCookie(event: H3Event) {
  deleteCookie(event, FINANCE_SESSION_COOKIE, financeSessionCookieOptions(event));
}
