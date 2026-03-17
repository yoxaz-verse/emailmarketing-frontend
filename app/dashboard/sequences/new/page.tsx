import { redirect } from 'next/navigation';
import { serverFetch } from '@/lib/server/server-fetch';

export default async function NewSequencePage() {
  const sequence = await serverFetch<{ id: string }>('/sequences', {
    method: 'POST',
    body: JSON.stringify({
      name: 'New Sequence',
      graph_json: { nodes: [], edges: [] },
    }),
  });

  redirect(`/dashboard/sequences/${sequence.id}`);
}
