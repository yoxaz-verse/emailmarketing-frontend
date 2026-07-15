const AUTH_COOKIE_NAMES = ['auth_token', 'user_role', 'operator_id', 'user_access_flags', 'login_error'] as const;
const MAX_AUTH_COOKIE_AGE_SECONDS = 60 * 60 * 12;
const DEFAULT_CLOCK_SKEW_SECONDS = 30;

type CookieClearingResponse = {
  cookies: {
    delete: (name: string) => unknown;
    set?: (name: string, value: string, options: { path: string; maxAge: number }) => unknown;
  };
};

type JwtPayloadWithExpiry = {
  exp?: unknown;
};

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const paddingLength = (4 - (normalized.length % 4)) % 4;
    return atob(`${normalized}${'='.repeat(paddingLength)}`);
  } catch {
    return null;
  }
}

export function decodeJwtExpiry(token: string | undefined | null): number | null {
  if (!token) return null;

  const [, payload] = token.split('.');
  if (!payload) return null;

  const decodedPayload = decodeBase64Url(payload);
  if (!decodedPayload) return null;

  try {
    const parsed = JSON.parse(decodedPayload) as JwtPayloadWithExpiry;
    const exp = Number(parsed.exp);
    return Number.isFinite(exp) && exp > 0 ? exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(
  token: string | undefined | null,
  clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS
): boolean {
  const exp = decodeJwtExpiry(token);
  if (!exp) return true;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + clockSkewSeconds;
}

export function authCookieMaxAge(token: string | undefined | null): number {
  const exp = decodeJwtExpiry(token);
  if (!exp) return 0;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsUntilExpiry = exp - nowSeconds;
  if (secondsUntilExpiry <= DEFAULT_CLOCK_SKEW_SECONDS) return 0;

  return Math.min(secondsUntilExpiry, MAX_AUTH_COOKIE_AGE_SECONDS);
}

export function clearAuthCookies<T extends CookieClearingResponse>(response: T): T {
  for (const name of AUTH_COOKIE_NAMES) {
    response.cookies.delete(name);
    response.cookies.set?.(name, '', { path: '/', maxAge: 0 });
  }
  return response;
}
