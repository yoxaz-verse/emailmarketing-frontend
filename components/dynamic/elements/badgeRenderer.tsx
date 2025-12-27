'use client';

import { Badge } from '@/components/ui/badge';

export default function BadgeRenderer({
  config,
  value,
}: {
  config: {
    truthyLabel: string;
    falsyLabel: string;
  };
  value: boolean;
}) {
  return (
    <Badge variant={value ? 'default' : 'secondary'}>
      {value ? config.truthyLabel : config.falsyLabel}
    </Badge>
  );
}
