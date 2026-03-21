'use client';

import { useTransition } from 'react';
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
  const [isPending, startTransition] = useTransition();

  if (!actions?.length) return null;

  async function handleAction(key: string, handler: any) {
    startTransition(async () => {
      try {
        const result = await handler(row);
        if (result?.success) {
          toast.success(`${key.replace(/([A-Z])/g, ' $1')} successful!`);
        } else if (result?.error) {
          toast.error(result.error);
        }
      } catch (err: any) {
        toast.error(err.message || 'Action failed');
      }
    });
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

        // 🔹 VIEW / REDIRECT ACTION
        if (action.key === 'viewCampaign' || action.key === 'viewSequence') {
          return (
            <Button
              key={action.key}
              size="sm"
              variant={action.variant ?? 'outline'}
              disabled={isPending}
              onClick={() => handler(row)}
            >
              {action.label}
            </Button>
          );
        }

        // 🔹 SERVER MUTATION ACTIONS
        return (
          <Button
            key={action.key}
            size="sm"
            variant={action.variant ?? 'default'}
            disabled={isPending}
            onClick={() => handleAction(action.key, handler)}
          >
            {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
