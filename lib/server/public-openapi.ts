import 'server-only';
import { getApiBaseUrl } from './api-config';

export async function loadPublicOpenApi(): Promise<{ baseUrl: string; spec: any | null }> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/v1/openapi.json`, { cache: 'no-store' });
    if (!response.ok) return { baseUrl, spec: null };
    return { baseUrl, spec: await response.json() };
  } catch {
    return { baseUrl: '', spec: null };
  }
}
