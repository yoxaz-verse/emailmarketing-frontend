'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function serverFetch<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const startedAt = performance.now();
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
      `${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`,
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
    if (
      message.includes('fetch failed') ||
      message.includes('econnrefused') ||
      message.includes('socket') ||
      message.includes('abort')
    ) {
      throw new Error(message.includes('abort')
        ? `Backend request timed out after ${timeoutMs}ms.`
        : 'Backend unavailable. Please ensure backend is running and retry.');
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
  return (raw ? JSON.parse(raw) : null) as T;
}
