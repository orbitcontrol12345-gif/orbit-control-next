import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type AttemptRecord = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptRecord>();

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();

  return timingSafeEqual(leftHash, rightHash);
}

function getClientKey(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(key: string): boolean {
  const record = attempts.get(key);

  if (!record) return false;

  if (record.resetAt <= Date.now()) {
    attempts.delete(key);
    return false;
  }

  return record.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing || existing.resetAt <= now) {
    attempts.set(key, {
      count: 1,
      resetAt: now + ATTEMPT_WINDOW_MS,
    });
    return;
  }

  existing.count += 1;

  if (attempts.size > 5000) {
    for (const [attemptKey, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(attemptKey);
    }
  }
}

function getSafeNextPath(value: FormDataEntryValue | null): string {
  const path = String(value || '');

  if (
    !path.startsWith('/admin') ||
    path.startsWith('//') ||
    path.startsWith('/admin/login')
  ) {
    return '/admin/products';
  }

  return path;
}

function loginRedirect(
  request: Request,
  error: 'invalid' | 'rate-limit' | 'configuration',
  nextPath: string,
) {
  const url = new URL('/admin/login', request.url);
  url.searchParams.set('error', error);
  url.searchParams.set('next', nextPath);

  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get('username') || '').trim();
  const password = String(form.get('password') || '');
  const nextPath = getSafeNextPath(form.get('next'));
  const expectedUsername = process.env.ADMIN_USERNAME?.trim() || '';
  const expectedPassword = process.env.ADMIN_PASSWORD || '';
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim() || '';

  if (
    !expectedUsername ||
    expectedPassword.length < 12 ||
    sessionSecret.length < 32
  ) {
    return loginRedirect(request, 'configuration', nextPath);
  }

  if (username.length > 100 || password.length > 256) {
    return loginRedirect(request, 'invalid', nextPath);
  }

  const clientKey = getClientKey(request);

  if (isRateLimited(clientKey)) {
    return loginRedirect(request, 'rate-limit', nextPath);
  }

  const validUsername = safeEqual(username, expectedUsername);
  const validPassword = safeEqual(password, expectedPassword);
  const validCredentials = validUsername && validPassword;

  if (!validCredentials) {
    recordFailure(clientKey);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return loginRedirect(request, 'invalid', nextPath);
  }

  attempts.delete(clientKey);

  const token = await createAdminSessionToken(expectedUsername);
  const response = NextResponse.redirect(
    new URL(nextPath, request.url),
    303,
  );

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return response;
}
