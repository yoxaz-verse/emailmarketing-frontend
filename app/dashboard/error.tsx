'use client';

import { useEffect } from 'react';
import BackendUnavailableScreen from '@/components/dashboard/BackendUnavailableScreen';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const details = {
      digest: error.digest ?? 'unavailable',
      name: error.name,
    };
    if (process.env.NODE_ENV === 'development') {
      console.warn('[DASHBOARD_RENDER_ERROR]', details);
    } else {
      console.error('[DASHBOARD_RENDER_ERROR]', details);
    }
  }, [error]);

  return (
    <BackendUnavailableScreen
      title="This dashboard page could not load"
      message="The request failed before this page finished loading. Your session is still saved; retry now or sign out if the problem continues."
      reference={error.digest}
      onRetry={reset}
    />
  );
}
