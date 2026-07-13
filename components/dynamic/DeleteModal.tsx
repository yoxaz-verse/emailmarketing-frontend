'use client';

import { useEffect, useState } from 'react';
import type { CampaignDeletePreview } from '@/lib/crud-server';
import { deleteRow, getDeletePreview } from "./action";
import { executeAction } from "@/lib/action-executor";
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';


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
  const [preview, setPreview] = useState<CampaignDeletePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(table === 'campaigns');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const isCampaignDelete = table === 'campaigns';

  useEffect(() => {
    let cancelled = false;
    if (!isCampaignDelete) return;

    setIsPreviewLoading(true);
    setPreviewError(null);
    getDeletePreview(table, id)
      .then((result) => {
        if (cancelled) return;
        setPreview(result);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setPreviewError(error?.message || 'Failed to load delete preview');
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, isCampaignDelete, table]);

  async function confirm() {
    if (isSubmitting || isPreviewLoading || previewError || (isCampaignDelete && preview?.canDelete === false)) return;
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

  const deleteItems = preview
    ? [
        ['Campaign', preview.deletes.campaigns],
        ['Attached campaign leads', preview.deletes.campaign_leads],
        ['Sender inbox links', preview.deletes.campaign_inboxes],
        ['Voice-agent links', preview.deletes.campaign_voice_agents],
        ['Send logs', preview.deletes.email_logs],
        ['Tracking events', preview.deletes.email_tracking_events],
      ]
    : [];

  const deleteDisabled =
    isSubmitting ||
    isPreviewLoading ||
    Boolean(previewError) ||
    (isCampaignDelete && preview?.canDelete !== true);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card text-card-foreground border border-border p-6 rounded space-y-4 shadow-xl">
        <h2 className="text-lg font-semibold">Confirm Delete</h2>
        <p className="text-sm text-muted-foreground">
          {isCampaignDelete
            ? 'Review what will be deleted before confirming. This action cannot be undone.'
            : 'This action cannot be undone.'}
        </p>

        {isCampaignDelete && (
          <div className="space-y-3 rounded border border-border bg-background/40 p-4">
            {isPreviewLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading delete impact...
              </div>
            )}

            {!isPreviewLoading && previewError && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{previewError}</span>
              </div>
            )}

            {!isPreviewLoading && preview && (
              <>
                <div className="space-y-1">
                  <div className="text-sm font-semibold">
                    {preview.campaign.name || 'Untitled campaign'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Status: {preview.campaign.status || 'unknown'}
                  </div>
                </div>

                {preview.blocker && (
                  <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{preview.blocker}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Will be deleted
                  </div>
                  <div className="space-y-1">
                    {deleteItems.map(([label, count]) => (
                      <div key={label} className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Preserved: master leads, inboxes, voice agents, sequences, operators, and users.
                </div>
              </>
            )}
          </div>
        )}

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
            disabled={deleteDisabled}
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
