'use client';

import { useState } from 'react';
import { deleteRow } from "./action";
import { executeAction } from "@/lib/action-executor";
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';


export default function DeleteModal({
  table,
  id,
  onClose,
  onSuccess,
  onSubmittingChange
}: {
  table: string;
  id: string;
  onClose: () => void;
  onSuccess: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function confirm() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onSubmittingChange?.(true);

    const label = table.replace('_', ' ');
    try {
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
    } finally {
      setIsSubmitting(false);
      onSubmittingChange?.(false);
    }
  }


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-card text-card-foreground border border-border p-6 rounded space-y-4">
        <h2 className="text-lg font-semibold">Confirm Delete</h2>
        <p className="text-muted-foreground">This action cannot be undone.</p>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting}
            onClick={confirm}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}
