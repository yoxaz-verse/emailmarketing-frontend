"use client";

import { useEffect } from 'react';
import { clientFetch } from '@/lib/client-fetch';

export default function AuthGuardClient() {
  useEffect(() => {
    let active = true;
    clientFetch('/auth/me')
      .catch(() => {
        if (active) {
          // Non-destructive in production: do not force logout on transient
          // backend/network/auth-me failures. Server-side guards remain source of truth.
          console.warn('[AuthGuardClient] /auth/me check failed; keeping current session.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
