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
  return { success: true };
}

export async function updateRow(
  table: string,
  id: string,
  payload: any
) {
  await crudServer.update(table, id, payload);
  revalidatePath(`/dashboard/${table}`);
  return { success: true };
}

export async function deleteRow(
    table: string,
    id: string
  ) {
    await crudServer.delete(table, id);
    revalidatePath(`/dashboard/${table}`);
    return { success: true };
  }

export async function bulkDeleteRows(
  table: string,
  ids: string[]
) {
  const uniqueIds = Array.from(new Set((ids ?? []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
  if (uniqueIds.length === 0) {
    throw new Error('No rows selected for bulk delete');
  }

  const result = await crudServer.bulkDelete(table, uniqueIds);
  revalidatePath(`/dashboard/${table}`);
  return result;
}
