'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { actionRegistry } from '@/config/actionRegistry';

type ActionConfig = {
  key: string;
  label: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  visible?: (row: TableRow) => boolean;
};

type TableRow = Record<string, unknown>;
type ActionResult = { success?: boolean; error?: string } | void;

type Props = {
  actions: ActionConfig[];
  row: TableRow;
};

export default function ActionRenderer({ actions, row }: Props) {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  if (!actions?.length) return null;

  function actionId(actionKey: string): string {
    return `${String(row?.id ?? 'row')}:${actionKey}`;
  }

  function pendingLabel(actionKey: string): string {
    if (actionKey === 'startCampaign') return 'Starting...';
    if (actionKey === 'pauseCampaign') return 'Pausing...';
    return 'Processing...';
  }

  async function handleAction(
    key: string,
    handler: (selectedRow: TableRow) => ActionResult | Promise<ActionResult>
  ) {
    const id = actionId(key);
    if (pendingActionId === id) return;
    setPendingActionId(id);

    try {
      const result = await handler(row);
      if (result?.success) {
        toast.success(`${key.replace(/([A-Z])/g, ' $1')} successful!`);
      } else if (result?.error) {
        toast.error(result.error);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPendingActionId((current) => (current === id ? null : current));
    }
  }

  return (
    <div className="flex justify-end gap-2">
      {actions.map((action) => {
        if (action.visible && !action.visible(row)) {
          return null;
        }

        const handler = actionRegistry[action.key] as
          | ((selectedRow: TableRow) => ActionResult | Promise<ActionResult>)
          | undefined;

        if (!handler) {
          console.warn(`[ActionRenderer] Missing action: ${action.key}`);
          return null;
        }

        const id = actionId(action.key);
        const isThisPending = pendingActionId === id;
        const label = isThisPending ? pendingLabel(action.key) : action.label;

        // 🔹 VIEW / REDIRECT ACTION
        if (action.key === 'viewCampaign' || action.key === 'viewSequence') {
          const href = action.key === 'viewCampaign'
            ? `/dashboard/campaign/${row.id}`
            : `/dashboard/sequences/${row.id}`;

          return (
            <Button key={action.key} size="sm" variant={action.variant ?? 'outline'} asChild>
              <Link href={href}>
                {action.label}
              </Link>
            </Button>
          );
        }

        // 🔹 SERVER MUTATION ACTIONS
        return (
          <Button
            key={action.key}
            size="sm"
            variant={action.variant ?? 'default'}
            disabled={isThisPending}
            onClick={() => handleAction(action.key, handler)}
          >
            {isThisPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {label}
          </Button>
        );
      })}
    </div>
  );
}
