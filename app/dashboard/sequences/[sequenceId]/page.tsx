import DynamicTable from '@/components/dynamic/dynamicTable';
import { serverFetch } from '@/lib/server/server-fetch';

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ sequenceId: string }>;
}) {
  const { sequenceId } = await params;

  const data = await serverFetch<any[]>(
    `/crud/sequence_steps?sequence_id=${sequenceId}`
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Sequence Steps</h1>
        <p className="text-sm text-muted-foreground">
          Manage the message steps for this sequence.
        </p>
      </div>
      <DynamicTable
        table="sequence_steps"
        data={data}
        defaultValues={{ sequence_id: sequenceId }}
      />
    </div>
  );
}
