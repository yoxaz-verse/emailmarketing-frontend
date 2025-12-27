'use client';

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
  if (!actions?.length) return null;

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
        if (action.key === 'viewCampaign') {
          return (
            <Button
              key={action.key}
              size="sm"
              variant={action.variant ?? 'outline'}
              onClick={() => handler(row)}
            >
              {action.label}
            </Button>
          );
        }

        // 🔹 SERVER MUTATION ACTIONS
        return (
          <form key={action.key} action={handler.bind(null, row)}>
            <Button
              size="sm"
              variant={action.variant ?? 'default'}
              type="submit"
            >
              {action.label}
            </Button>
          </form>
        );
      })}
    </div>
  );
}
