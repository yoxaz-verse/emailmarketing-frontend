'use client';

import DynamicTable from '@/components/dynamic/dynamicTable';
import { RelationMap } from '@/lib/resolveRelation';

type Props = {
  view: 'free' | 'used' | 'blocked';
  data: any[];
  role?: string;
  relations: RelationMap;
};

export default function LeadsTableClient({
  view,
  data,
  role,
  relations,
}: Props) {
  return (
    <DynamicTable
      key={`leads-${view}`}
      table="leads"
      data={data}
      role={role}
      relations={relations}
    />
  );
}
