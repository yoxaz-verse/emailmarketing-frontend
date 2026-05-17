import { cookies } from 'next/headers';
import SocialConnectorsClient from './SocialConnectorsClient';
import { serverFetch } from '@/lib/server/server-fetch';

type Operator = { id: string; name: string; region?: string | null };
type OperatorLoadErrorKind = 'backend_unavailable' | 'unauthorized' | 'unknown';

function normalizeOperatorLoadError(err: unknown): {
  message: string;
  kind: OperatorLoadErrorKind;
} {
  const raw = err instanceof Error ? err.message : 'Unknown operator load error';
  const lower = raw.toLowerCase();

  if (
    lower.includes('backend unavailable') ||
    lower.includes('fetch failed') ||
    lower.includes('econnrefused')
  ) {
    return {
      message: 'Operator list is unavailable because backend is not reachable. Please ensure backend is running on the configured API base URL.',
      kind: 'backend_unavailable',
    };
  }

  if (
    lower.includes('unauthorized') ||
    lower.includes('authentication required') ||
    lower.includes('insufficient permissions') ||
    lower.includes('forbidden')
  ) {
    return {
      message: 'Operator list cannot be loaded due to authorization or role mismatch.',
      kind: 'unauthorized',
    };
  }

  return {
    message: raw,
    kind: 'unknown',
  };
}

export default async function SocialConnectorsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = role === 'admin' || role === 'superadmin';

  let operators: Operator[] = [];
  let operatorLoadError: string | undefined;
  let operatorLoadErrorKind: OperatorLoadErrorKind | undefined;

  if (isAdmin) {
    try {
      operators = await serverFetch<Operator[]>('/admin/operators');
    } catch (err: unknown) {
      const normalized = normalizeOperatorLoadError(err);
      operatorLoadError = normalized.message;
      operatorLoadErrorKind = normalized.kind;
      operators = [];
    }
  }

  return (
    <SocialConnectorsClient
      role={role}
      operators={operators}
      operatorLoadError={operatorLoadError}
      operatorLoadErrorKind={operatorLoadErrorKind}
    />
  );
}
