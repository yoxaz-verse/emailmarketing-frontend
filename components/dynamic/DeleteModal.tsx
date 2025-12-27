'use client';

import { deleteRow } from "./action";


export default function DeleteModal({
  table,
  id,
  onClose,
  onSuccess
}: {
  table: string;
  id: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
    async function confirm() {
        await deleteRow(table, id);
        onSuccess();
        onClose();
      }
    

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-6 rounded space-y-4">
        <h2 className="text-lg font-semibold">Confirm Delete</h2>
        <p>This action cannot be undone.</p>

        <div className="flex justify-end gap-2">
          <button onClick={onClose}>Cancel</button>
          <button
            className="bg-red-600 text-white px-4 py-1 rounded"
            onClick={confirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
