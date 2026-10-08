export const AUTH_COOKIE_NAMES = ['auth_token', 'user_role', 'operator_id', 'user_access_flags', 'user_email', 'login_error'] as const;
const MAX_AUTH_COOKIE_AGE_SECONDS = 60 * 60 * 12;
const DEFAULT_CLOCK_SKEW_SECONDS = 30;

type CookieClearingResponse = {
  headers: {
    append: (name: string, value: string) => unknown;
  };
  cookies: {
    delete: (name: string) => unknown;
    set?: (name: string, value: string, options: {
      path: string;
      maxAge: number;
      expires?: Date;
      domain?: string;
      httpOnly?: boolean;
      sameSite?: 'lax';
      secure?: boolean;
    }) => unknown;
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

export function authCookieParentDomain(hostname: string): string | null {
  const configuredDomain = String(process.env.AUTH_COOKIE_PARENT_DOMAIN ?? '').trim();
  if (configuredDomain) return configuredDomain;

  const normalizedHostname = hostname.trim().toLowerCase().replace(/^\.+/, '');
  if (normalizedHostname === 'obaol.com' || normalizedHostname.endsWith('.obaol.com')) {
    return '.obaol.com';
  }

  return null;
}

export function clearAuthCookies<T extends CookieClearingResponse>(
  response: T,
  options: { hostname?: string; secure?: boolean } = {}
): T {
  const expired = new Date(0);
  const baseOptions = {
    path: '/',
    maxAge: 0,
    expires: expired,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: options.secure ?? false,
  };
  const parentDomain = options.hostname
    ? authCookieParentDomain(options.hostname)
    : null;

  for (const name of AUTH_COOKIE_NAMES) {
    response.cookies.delete(name);
    response.cookies.set?.(name, '', baseOptions);
  }

  if (parentDomain) {
    for (const name of AUTH_COOKIE_NAMES) {
      response.headers.append(
        'set-cookie',
        `${name}=; Path=/; Expires=${expired.toUTCString()}; Max-Age=0; Domain=${parentDomain};${baseOptions.secure ? ' Secure;' : ''} HttpOnly; SameSite=Lax`
      );
    }
  }
  return response;
}

export function appendParentDomainAuthCookieClears<T extends Pick<CookieClearingResponse, 'headers'>>(
  response: T,
  options: { hostname: string; secure: boolean }
): T {
  const parentDomain = authCookieParentDomain(options.hostname);
  if (!parentDomain) return response;

  const expired = new Date(0).toUTCString();
  for (const name of AUTH_COOKIE_NAMES) {
    response.headers.append(
      'set-cookie',
      `${name}=; Path=/; Expires=${expired}; Max-Age=0; Domain=${parentDomain};${options.secure ? ' Secure;' : ''} HttpOnly; SameSite=Lax`
    );
  }
  return response;
}
