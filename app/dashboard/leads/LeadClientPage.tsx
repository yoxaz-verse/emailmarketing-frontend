'use client';

import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useState } from 'react';

import DynamicTable from '@/components/dynamic/dynamicTable';
import { Button } from '@/components/ui/button';
import { RunValidationButton } from '@/components/buttton/RunValidationButton';

import {
  Database,
  CheckCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';

type View =
  | 'free'
  | 'used'
  | 'blocked'
  | 'validity';

type Props = {
  leads: any[];
  relations: any;
  role?: string;
};

export default function LeadsClientPage({
  leads,
  relations,
  role,
}: Props) {
  const [view, setView] = useState<View>('free');

  const filteredLeads = leads.filter(lead => {
    if (view === 'used') {
      return lead.is_used === true && lead.is_blocked !== true;
    }

    if (view === 'blocked') {
      return lead.is_blocked === true;
    }

    if (view === 'validity') {
      return (
        lead.eligibility_status === 'pending' ||
        lead.eligibility_status === 'checking'
      );
    }

    return lead.is_used !== true && lead.is_blocked !== true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline">Upload Leads</Button>
        <RunValidationButton />
      </div>

      {/* Radix ToggleGroup (NO navigation) */}
      <ToggleGroup.Root
        type="single"
        value={view}
        onValueChange={v => v && setView(v as View)}
        className="flex gap-2"
      >
        <ToggleItem value="free" icon={<Database color="lightgreen" size={16} />} label="Free" />
        <ToggleItem value="used" icon={<CheckCircle color="gray" size={16} />} label="Used" />
        <ToggleItem value="blocked" icon={<AlertTriangle color="red" size={16} />} label="Blocked" />
        <ToggleItem value="validity" icon={<Clock color="lightblue" size={16} />} label="Validity Pending" />
      </ToggleGroup.Root>

      {/* Table */}
      <DynamicTable
        table="leads"
        data={filteredLeads}
        role={role}
        relations={relations}
      />
    </div>
  );
}

function ToggleItem({
  value,
  icon,
  label,
}: {
  value: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <ToggleGroup.Item
      value={value}
      className="
        flex items-center gap-2
        px-2 py-1 rounded-md text-xs
        border
        data-[state=on]:bg-primary
        data-[state=on]:text-primary-foreground
      "
    >
      {icon}
      {label}
    </ToggleGroup.Item>
  );
}
