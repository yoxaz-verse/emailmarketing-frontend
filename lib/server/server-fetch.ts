'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getApiBaseHostname, getApiBaseUrl } from './api-config';
import { BackendUnavailableError } from './backend-error';

function logBackendFailure(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(event, details);
    return;
  }
  console.error(event, details);
}

export async function serverFetch<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const startedAt = performance.now();
  let apiBase: string;
  try {
    apiBase = getApiBaseUrl();
  } catch (error) {
    logBackendFailure('[SERVER_FETCH_UNAVAILABLE]', {
      path,
      kind: 'configuration',
      backendHost: 'unconfigured',
    });
    throw error;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const { timeoutMs = 15_000, signal: callerSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  let res: Response;
  try {
    res = await fetch(
      `${apiBase}${path}`,
      {
        ...fetchOptions,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          ...(fetchOptions.headers || {}),
        },
        cache: 'no-store',
        signal: controller.signal,
      }
    );
  } catch (err: unknown) {
    const typedErr = err as { message?: string };
    const message = String(typedErr?.message ?? '').toLowerCase();
    const isTimeout = controller.signal.aborted || message.includes('abort');
    if (
      message.includes('fetch failed') ||
      message.includes('econnrefused') ||
      message.includes('socket') ||
      isTimeout
    ) {
      const kind = isTimeout ? 'timeout' : 'connection';
      logBackendFailure('[SERVER_FETCH_UNAVAILABLE]', {
        path,
        kind,
        backendHost: getApiBaseHostname(),
      });
      throw new BackendUnavailableError(
        isTimeout
          ? `Backend request timed out after ${timeoutMs}ms.`
          : 'Backend unavailable. Please ensure backend is running and retry.',
        { kind, cause: err }
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }

  if (res.status === 401 || res.status === 403) {
    redirect('/api/auth/logout?reason=session-expired');
  }

  if (!res.ok) {
    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    const parsedObj = (typeof parsed === 'object' && parsed !== null)
      ? (parsed as { error?: string; message?: string })
      : null;
    const message =
      parsedObj?.error ||
      parsedObj?.message ||
      (typeof parsed === 'string' ? parsed : null) ||
      raw ||
      `Request failed with status ${res.status}`;

    if (res.status >= 500) {
      logBackendFailure('[SERVER_FETCH_UNAVAILABLE]', {
        path,
        kind: 'upstream',
        status: res.status,
        backendHost: getApiBaseHostname(),
      });
      throw new BackendUnavailableError(
        `Backend request failed with status ${res.status}.`,
        { kind: 'upstream', statusCode: res.status, raw }
      );
    }

    const error = new Error(message) as Error & {
      statusCode?: number;
      raw?: string;
    };
    error.statusCode = res.status;
    error.raw = raw;
    throw error;
  }

  const raw = await res.text();
  const durationMs = Math.round(performance.now() - startedAt);
  if (durationMs >= 750) {
    console.warn('[serverFetch:slow]', {
      path,
      status: res.status,
      durationMs,
      payloadBytes: Buffer.byteLength(raw, 'utf8'),
    });
  }
  try {
    return (raw ? JSON.parse(raw) : null) as T;
  } catch (cause) {
    logBackendFailure('[SERVER_FETCH_INVALID_RESPONSE]', {
      path,
      status: res.status,
      backendHost: getApiBaseHostname(),
    });
    throw new BackendUnavailableError('Backend returned an invalid JSON response.', {
      kind: 'invalid-response',
      statusCode: res.status,
      cause,
    });
  }
}
