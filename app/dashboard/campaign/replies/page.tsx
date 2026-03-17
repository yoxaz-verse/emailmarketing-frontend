import { serverFetch } from '@/lib/server/server-fetch';

type Reply = {
  id: string;
  email: string;
  first_name: string;
  company: string;
  replied_at: string;
  reply_message: string;
  inboxes?: {
    email_address: string;
  };
};

export default async function OperatorRepliesPage() {
  const replies = await serverFetch<Reply[]>('/operator/replies');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Replies</h2>

      {replies.length === 0 && (
        <p className="text-sm text-muted-foreground">No replies yet</p>
      )}

      {replies.map((r) => (
        <div
          key={r.id}
          className="border border-border rounded bg-card p-4"
        >
          <div className="text-sm font-medium">
            {r.first_name} ({r.email})
          </div>

          <div className="text-xs text-muted-foreground">
            Company: {r.company} • Replied at{' '}
            {new Date(r.replied_at).toLocaleString()}
          </div>

          <div className="mt-2 text-sm whitespace-pre-wrap">
            {r.reply_message}
          </div>

          {r.inboxes?.email_address && (
            <div className="mt-2 text-xs text-muted-foreground">
              Received via {r.inboxes.email_address}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
