// lib/crud-server.ts
import { serverFetch } from './server-fetch';

export const crudServer = {
  
  list: (table: string) =>
    serverFetch<any[]>(`/crud/${table}`),

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
    })
};
