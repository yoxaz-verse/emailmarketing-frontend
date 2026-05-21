"use client";

import { useEffect } from 'react';
import { clientFetch } from '@/lib/client-fetch';

export default function AuthGuardClient() {
  useEffect(() => {
    let active = true;
    clientFetch('/auth/me')
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : '';
          if (message === 'UNAUTHORIZED') {
            return;
          }
          console.warn('[AuthGuardClient] /auth/me check failed.', { message });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
