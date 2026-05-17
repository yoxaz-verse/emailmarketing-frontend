// lib/client-fetch.ts
type ApiErrorShape = {
  error?: string;
  message?: string;
  detail?: string;
  ok?: boolean;
};

function isHtmlLikeResponse(raw: string): boolean {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}

function parseErrorText(raw: string): {
  message: string;
  detail?: string;
  statusText?: string;
  isAuthLike?: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { message: 'Request failed' };

  try {
    const parsed = JSON.parse(trimmed) as ApiErrorShape;
    const message = String(parsed.error ?? parsed.message ?? '').trim();
    const detail = String(parsed.detail ?? '').trim();
    if (message) {
      return {
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
  const msg = parsed.message.toLowerCase();
  const detail = String(parsed.detail ?? '').toLowerCase();

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
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = normalizedPath.startsWith('/api/')
    ? normalizedPath
    : `/api/proxy${normalizedPath}`;

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    const raw = await res.text();
    const parsed = parseErrorText(raw);
    const isConfirmedAuthFailure = Boolean(parsed.isAuthLike);

    if (isConfirmedAuthFailure && typeof window !== 'undefined') {
      window.location.href = '/api/auth/logout';
      throw new Error('UNAUTHORIZED');
    }

    throw new Error(normalizeClientError(res.status, raw));
  }

  if (!res.ok) {
    const raw = await res.text();
    throw new Error(normalizeClientError(res.status, raw));
  }

  return res.json();
}
