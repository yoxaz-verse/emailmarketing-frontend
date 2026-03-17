'use client';

import { deleteRow } from "./action";
import { executeAction } from "@/lib/action-executor";


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
    const label = table.replace('_', ' ');
    const res = await executeAction(
      () => deleteRow(table, id),
      {
        success: `${label} deleted`,
        error: `Failed to delete ${label}`
      }
    );

    if (res !== undefined) {
      onSuccess();
      onClose();
    }
  }


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-card text-card-foreground border border-border p-6 rounded space-y-4">
        <h2 className="text-lg font-semibold">Confirm Delete</h2>
        <p className="text-muted-foreground">This action cannot be undone.</p>

        <div className="flex justify-end gap-2">
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            Cancel
          </button>
          <button
            className="bg-destructive text-white px-4 py-1 rounded"
            onClick={confirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
