export function authErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
    return String(parsed.error ?? parsed.message ?? raw).trim();
  } catch {
    return raw.trim();
  }
}

export function isAuthInvalidationError(status: number, raw: string): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;
  return /unauthorized|invalid token|token expired|jwt expired|invalid signature|authentication required|session expired|sign(?:ed)? in again|user disabled/i.test(authErrorMessage(raw));
}

export function classifyTransportFailure(aborted: boolean): 'timeout' | 'backend_unavailable' {
  return aborted ? 'timeout' : 'backend_unavailable';
}
