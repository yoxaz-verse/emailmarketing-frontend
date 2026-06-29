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
import { serverFetch } from '@/lib/server/server-fetch';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

export default async function InboxesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const pageNumber = Math.max(1, Number(query.page ?? 1) || 1);
  const result = await serverFetch<{ rows: any[]; total: number; page: number; page_size: number }>(`/stats/inboxes?page=${pageNumber}&page_size=50`);
  const inboxes = result.rows;
  const cookieStore = await cookies();
  const roleCookie =  cookieStore.get('user_role');
  const role = roleCookie?.value;

  if (role === 'operator') {
    redirect('/dashboard');
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Inboxes</h2>

      <div className="rounded border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Replies</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {inboxes.map((inbox) => (
              <TableRow key={inbox.inbox_id}>
                <TableCell>{inbox.email_address}</TableCell>

                <TableCell>
                  <Badge
                    variant={
                      inbox.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {inbox.status}
                  </Badge>
                </TableCell>

                <TableCell>{inbox.health_score}</TableCell>
                <TableCell>{inbox.sent_total}</TableCell>
                <TableCell>{inbox.failed_total}</TableCell>
                <TableCell>{inbox.replies_count}</TableCell>

                <TableCell className="text-right space-x-2">
                  {inbox.status === 'active' ? (
                    <form
                      action={async () => {
                        'use server';
                        await serverFetch(
                          `/admin/inbox/${inbox.inbox_id}/pause`,
                          { method: 'POST' }
                        );
                        revalidatePath('/dashboard/inboxes');
                      }}
                      className="inline"
                    >
                      <Button size="sm" variant="outline">
                        Pause
                      </Button>
                    </form>
                  ) : (
                    <form
                      action={async () => {
                        'use server';
                        await serverFetch(
                          `/admin/inbox/${inbox.inbox_id}/resume`,
                          { method: 'POST' }
                        );
                        revalidatePath('/dashboard/inboxes');
                      }}
                      className="inline"
                    >
                      <Button size="sm">
                        Resume
                      </Button>
                    </form>
                  )}

                  <form
                    action={async () => {
                      'use server';
                      await serverFetch(
                        `/admin/inbox/${inbox.inbox_id}/hard-pause`,
                        { method: 'POST' }
                      );
                      revalidatePath('/dashboard/inboxes');
  }}
                    className="inline"
                  >
                    <Button size="sm" variant="destructive">
                      Hard Pause
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{result.total.toLocaleString()} inboxes · Page {result.page}</span>
        <div className="flex gap-2">{result.page > 1 ? <Link className="rounded border px-3 py-2" href={`?page=${result.page - 1}`}>Previous</Link> : null}{result.page * result.page_size < result.total ? <Link className="rounded border px-3 py-2" href={`?page=${result.page + 1}`}>Next</Link> : null}</div>
      </div>
    </div>
  );
}
