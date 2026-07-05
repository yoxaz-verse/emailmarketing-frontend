import 'server-only';

import { BackendUnavailableError } from './backend-error';

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!configured) {
    throw new BackendUnavailableError(
      'NEXT_PUBLIC_API_BASE_URL is missing. Configure the dashboard backend URL.',
      { kind: 'configuration' }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch (cause) {
    throw new BackendUnavailableError(
      'NEXT_PUBLIC_API_BASE_URL must be a valid absolute URL.',
      { kind: 'configuration', cause }
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BackendUnavailableError(
      'NEXT_PUBLIC_API_BASE_URL must use http or https.',
      { kind: 'configuration' }
    );
  }

  return configured.replace(/\/+$/, '');
}

export function getApiBaseHostname(): string {
  try {
    return new URL(getApiBaseUrl()).hostname;
  } catch {
    return 'unconfigured';
  }
}
