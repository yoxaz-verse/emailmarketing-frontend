'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { actionRegistry } from '@/config/actionRegistry';

type ActionConfig = {
  key: string;
  label: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  visible?: (row: any) => boolean;
};

type Props = {
  actions: ActionConfig[];
  row: any;
};

export default function ActionRenderer({ actions, row }: Props) {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  if (!actions?.length) return null;

  function actionId(actionKey: string): string {
    return `${String(row?.id ?? 'row')}:${actionKey}`;
  }

  function pendingLabel(actionKey: string, defaultLabel: string): string {
    if (actionKey === 'viewCampaign' || actionKey === 'viewSequence') return 'Opening...';
    if (actionKey === 'startCampaign') return 'Starting...';
    if (actionKey === 'pauseCampaign') return 'Pausing...';
    return 'Processing...';
  }

  async function handleAction(key: string, handler: any) {
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
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setPendingActionId((current) => (current === id ? null : current));
    }
  }

  function handleViewAction(key: string, handler: any) {
    const id = actionId(key);
    if (pendingActionId === id) return;
    setPendingActionId(id);
    try {
      handler(row);
    } catch (err: any) {
      setPendingActionId((current) => (current === id ? null : current));
      toast.error(err.message || 'Unable to open');
    }
  }

  return (
    <div className="flex justify-end gap-2">
      {actions.map((action) => {
        if (action.visible && !action.visible(row)) {
          return null;
        }

        const handler = actionRegistry[action.key];

        if (!handler) {
          console.warn(`[ActionRenderer] Missing action: ${action.key}`);
          return null;
        }

        const id = actionId(action.key);
        const isThisPending = pendingActionId === id;
        const label = isThisPending ? pendingLabel(action.key, action.label) : action.label;

        // 🔹 VIEW / REDIRECT ACTION
        if (action.key === 'viewCampaign' || action.key === 'viewSequence') {
          return (
            <Button
              key={action.key}
              size="sm"
              variant={action.variant ?? 'outline'}
              disabled={isThisPending}
              onClick={() => handleViewAction(action.key, handler)}
            >
              {isThisPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {label}
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
