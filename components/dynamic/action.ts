// components/dynamic/actions.ts
'use server';

import { crudServer } from '@/lib/crud-server';
import { revalidatePath } from 'next/cache';

export async function createRow(
  table: string,
  payload: any
) {
  await crudServer.create(table, payload);
  revalidatePath(`/dashboard/${table}`);
}

export async function updateRow(
  table: string,
  id: string,
  payload: any
) {
  await crudServer.update(table, id, payload);
  revalidatePath(`/dashboard/${table}`);
}

export async function deleteRow(
    table: string,
    id: string
  ) {
    await crudServer.delete(table, id);
    revalidatePath(`/dashboard/${table}`);
  }