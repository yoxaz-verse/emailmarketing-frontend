import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { serverFetch } from '@/lib/server-fetch';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function SequencesPage() {
  const sequences = await serverFetch<any[]>('/stats/sequences');
  const cookieStore = await cookies();
  const roleCookie = await cookieStore.get('user_role');
  const role = roleCookie?.value;
  
  if (role !== 'admin') {
    redirect('/dashboard'); // or 403 page
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Sequences</h2>

      <div className="rounded border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Stopped</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sequences.map((seq) => (
              <TableRow key={seq.sequence_id}>
                <TableCell>{seq.name}</TableCell>
                <TableCell>{seq.leads_enrolled}</TableCell>
                <TableCell>{seq.completed}</TableCell>
                <TableCell>{seq.stopped}</TableCell>

                <TableCell>
                  <Badge variant={seq.is_active ? 'default' : 'secondary'}>
                    {seq.is_active ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>

                <TableCell className="text-right space-x-2">
                  {seq.is_active ? (
                    <form
                      action={async () => {
                        'use server';
                        await serverFetch(
                          `/admin/sequence/${seq.sequence_id}/disable`,
                          { method: 'POST' }
                        );
                        revalidatePath('/dashboard/sequences');

                      }}
                      className="inline"
                    >
                      <Button size="sm" variant="outline">
                        Disable
                      </Button>
                    </form>
                  ) : (
                    <form
                      action={async () => {
                        'use server';
                        await serverFetch(
                          `/admin/sequence/${seq.sequence_id}/enable`,
                          { method: 'POST' }
                        );
                        revalidatePath('/dashboard/sequences');
                      }}
                      className="inline"
                    >
                      <Button size="sm">
                        Enable
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
