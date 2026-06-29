// lib/crud-server.ts
import { serverFetch } from './server/server-fetch';

export type CrudPage<T = any> = {
  rows: T[];
  total: number;
  page: number;
  page_size: number;
};

export const crudServer = {
  
  list: (table: string) =>
    serverFetch<any[]>(`/crud/${table}`),

  page: <T = any>(table: string, params: URLSearchParams) =>
    serverFetch<CrudPage<T>>(`/crud/${table}/page?${params.toString()}`),

  create: (table: string, payload: any) =>
    serverFetch(`/crud/${table}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  update: (table: string, id: string, payload: any) =>
    serverFetch(`/crud/${table}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  delete: (table: string, id: string) =>
    serverFetch(`/crud/${table}/${id}`, {
      method: 'DELETE'
    }),

  bulkDelete: (table: string, ids: string[]) =>
    serverFetch<{ success: boolean; deletedCount: number; requestedCount?: number; filteredCount?: number }>(`/crud/${table}/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ ids })
    })
};
