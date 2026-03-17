import Link from 'next/link';
import { serverFetch } from '@/lib/server/server-fetch';
import { Button } from '@/components/ui/button';

export type SequenceRow = {
  id: string;
  name: string;
  status?: string;
  created_at?: string;
};

export default async function SequencesPage() {
  const sequences = await serverFetch<SequenceRow[]>('/sequences');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sequences</h1>
          <p className="text-sm text-muted-foreground">
            Build and automate node-based sequences.
          </p>
        </div>
        <Link href="/dashboard/sequences/new">
          <Button>Create Sequence</Button>
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
          <div className="col-span-6">Name</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-3">Created</div>
        </div>
        <div className="divide-y">
          {sequences.map(sequence => (
            <Link
              key={sequence.id}
              href={`/dashboard/sequences/${sequence.id}`}
              className="grid grid-cols-12 gap-4 px-4 py-3 text-sm hover:bg-muted"
            >
              <div className="col-span-6 font-medium">{sequence.name}</div>
              <div className="col-span-3 capitalize">
                {sequence.status ?? 'draft'}
              </div>
              <div className="col-span-3 text-muted-foreground">
                {sequence.created_at
                  ? new Date(sequence.created_at).toLocaleDateString()
                  : '—'}
              </div>
            </Link>
          ))}
          {sequences.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No sequences yet. Create one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
