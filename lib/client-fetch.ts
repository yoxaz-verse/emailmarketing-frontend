// lib/client-fetch.ts
import { classifyTransportFailure, isAuthInvalidationError } from './auth-failure-policy';

type ApiErrorShape = {
  code?: string;
  error?: string;
  message?: string;
  detail?: string;
  ok?: boolean;
};

let hasTriggeredAuthRedirect = false;

export type ClientFetchErrorKind = 'unauthorized' | 'forbidden' | 'backend_unavailable' | 'timeout' | 'request';

export class ClientFetchError extends Error {
  constructor(
    message: string,
    readonly kind: ClientFetchErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ClientFetchError';
  }
}

function triggerAuthLogout(): void {
  if (typeof window === 'undefined' || hasTriggeredAuthRedirect) return;
  hasTriggeredAuthRedirect = true;
  window.location.href = '/api/auth/logout?reason=session-ended';
}

function parseErrorShape(raw: string): ApiErrorShape | null {
  try {
    const parsed = JSON.parse(raw) as ApiErrorShape;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function isHtmlLikeResponse(raw: string): boolean {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}

function parseErrorText(raw: string): {
  code?: string;
  message: string;
  detail?: string;
  statusText?: string;
  isAuthLike?: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { message: 'Request failed' };

  try {
    const parsed = JSON.parse(trimmed) as ApiErrorShape;
    const code = String(parsed.code ?? '').trim();
    const message = String(parsed.error ?? parsed.message ?? '').trim();
    const detail = String(parsed.detail ?? '').trim();
    if (message) {
      return {
        code: code || undefined,
        message,
        detail: detail || undefined,
        isAuthLike: /unauthorized|invalid token|authentication required|user disabled/i.test(message),
      };
    }
  } catch {
    // fall through to plain text handling
  }

  return {
    message: trimmed,
    isAuthLike: /unauthorized|invalid token|authentication required|user disabled/i.test(trimmed),
  };
}

function normalizeClientError(status: number, raw: string): string {
  if (isHtmlLikeResponse(raw)) {
    const lower = raw.toLowerCase();
    if (lower.includes('cannot get /admin/social-apps') || lower.includes('cannot post /admin/social-apps')) {
      return 'Social app settings endpoint is not available on the current backend instance. Please restart/update backend.';
    }
    return `Backend returned an unexpected HTML error (status ${status}). Please restart/update backend.`;
  }

  const parsed = parseErrorText(raw);
  const code = String(parsed.code ?? '').toUpperCase();
  const msg = parsed.message.toLowerCase();
  const detail = String(parsed.detail ?? '').toLowerCase();

  if (code === 'AUTH_SERVICE_MISCONFIGURED') {
    return parsed.message || 'Backend Supabase auth is misconfigured. Verify Supabase URL and service role key.';
  }

  if (code === 'AUTH_SERVICE_UNAVAILABLE') {
    return parsed.message || 'Supabase is unavailable from the backend right now.';
  }

  if (code === 'SOCIAL_OAUTH_SCHEMA_MISSING') {
    return parsed.message || 'Social OAuth tables are missing. Apply the social OAuth schema migration.';
  }

  if (code === 'PROVIDER_CONFIG_MISSING' || code === 'PROVIDER_CONFIG_ERROR') {
    return parsed.message || 'LinkedIn one-click connect needs the provider app credentials first.';
  }

  const isBackendUnavailable =
    status === 503 ||
    msg.includes('backend unavailable') ||
    msg.includes('fetch failed') ||
    detail.includes('fetch failed') ||
    detail.includes('econnrefused');

  if (isBackendUnavailable) {
    return 'Backend unavailable. Please ensure backend server is running.';
  }

  if (msg.includes('next_public_api_base_url is missing')) {
    return 'API base URL is not configured. Please set NEXT_PUBLIC_API_BASE_URL.';
  }

  if (parsed.message) return parsed.message;
  return `Request failed with status ${status}`;
}

export async function clientFetch<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const startedAt = performance.now();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = normalizedPath.startsWith('/api/')
    ? normalizedPath
    : `/api/proxy${normalizedPath}`;

  const { timeoutMs = 15_000, signal: callerSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchOptions,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    const failureKind = classifyTransportFailure(controller.signal.aborted);
    if (failureKind === 'timeout') {
      throw new ClientFetchError(`Request timed out after ${timeoutMs}ms.`, 'timeout');
    }
    throw new ClientFetchError(
      error instanceof Error ? error.message : 'Backend unavailable',
      'backend_unavailable',
    );
  } finally {
    window.clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }

  if (res.status === 401 || res.status === 403) {
    const raw = await res.text();

    if (isAuthInvalidationError(res.status, raw) && typeof window !== 'undefined') {
      triggerAuthLogout();
      throw new ClientFetchError('UNAUTHORIZED', 'unauthorized', res.status);
    }

    throw new ClientFetchError(normalizeClientError(res.status, raw), 'forbidden', res.status);
  }

  if (!res.ok) {
    const raw = await res.text();
    if (res.status >= 500) {
      throw new ClientFetchError(normalizeClientError(res.status, raw), 'backend_unavailable', res.status);
    }
    throw new ClientFetchError(normalizeClientError(res.status, raw), 'request', res.status);
  }

  const raw = await res.text();
  const durationMs = Math.round(performance.now() - startedAt);
  if (durationMs >= 750) {
    console.warn('[clientFetch:slow]', { path: normalizedPath, status: res.status, durationMs, payloadBytes: new Blob([raw]).size });
  }
  try {
    return (raw ? JSON.parse(raw) : null) as T;
  } catch {
    throw new ClientFetchError('Backend returned an invalid response.', 'backend_unavailable', res.status);
  }
}
