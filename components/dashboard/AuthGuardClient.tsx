"use client";

import { useEffect } from 'react';
import { clientFetch } from '@/lib/client-fetch';

export default function AuthGuardClient() {
  useEffect(() => {
    let active = true;
    clientFetch('/auth/me')
      .catch(() => {
        if (active) {
          window.location.href = '/api/auth/logout';
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
