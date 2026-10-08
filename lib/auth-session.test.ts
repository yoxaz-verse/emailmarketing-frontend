import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTH_COOKIE_NAMES, authCookieMaxAge, clearAuthCookies, isTokenExpired } from './auth-session.ts';

function tokenWithExpiry(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `header.${payload}.signature`;
}

test('auth cookie lifetime is capped at twelve hours and expired tokens are rejected', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.ok(authCookieMaxAge(tokenWithExpiry(now + (24 * 60 * 60))) <= 12 * 60 * 60);
  assert.equal(authCookieMaxAge(tokenWithExpiry(now - 1)), 0);
  assert.equal(isTokenExpired(tokenWithExpiry(now - 1)), true);
});

test('logout clears every managed cookie including user_email', () => {
  const deleted: string[] = [];
  const set: string[] = [];
  const response = {
    headers: { append() {} },
    cookies: {
      delete(name: string) { deleted.push(name); },
      set(name: string) { set.push(name); },
    },
  };
  clearAuthCookies(response);
  assert.ok(AUTH_COOKIE_NAMES.includes('user_email'));
  assert.deepEqual(deleted, [...AUTH_COOKIE_NAMES]);
  assert.deepEqual(set, [...AUTH_COOKIE_NAMES]);
});
