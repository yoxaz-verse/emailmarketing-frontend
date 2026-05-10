'use client';

import { useState, useTransition } from 'react';
import { reviewReplyInterestAction } from './actions';

type Reply = {
  id: string;
  email: string;
  first_name: string;
  company: string;
  replied_at: string;
  reply_message: string;
  interest_status?: 'unreviewed' | 'interested' | 'not_interested';
  interest_note?: string | null;
  interest_reviewed_at?: string | null;
  campaign_leads?: Array<{
    campaign_id?: string;
    campaigns?: {
      name?: string;
    };
  }>;
  inboxes?: {
    email_address: string;
  };
};

export default function RepliesReviewClient({ initialReplies }: { initialReplies: Reply[] }) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateInterest(leadId: string, interest_status: 'unreviewed' | 'interested' | 'not_interested') {
    setBusyLeadId(leadId);
    startTransition(async () => {
      try {
        await reviewReplyInterestAction({ leadId, interest_status });
        setReplies((prev) => prev.map((row) => (
          row.id === leadId
            ? {
                ...row,
                interest_status,
                interest_reviewed_at: interest_status === 'unreviewed' ? null : new Date().toISOString(),
              }
            : row
        )));
      } finally {
        setBusyLeadId(null);
      }
    });
  }

  if (replies.length === 0) {
    return <p className="text-sm text-muted-foreground">No replies yet</p>;
  }

  return (
    <div className="space-y-3">
      {replies.map((r) => {
        const current = r.interest_status ?? 'unreviewed';
        const disabled = isPending && busyLeadId === r.id;
        const campaignName = r.campaign_leads?.[0]?.campaigns?.name;
        return (
          <div key={r.id} className="border border-border rounded bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{r.first_name} ({r.email})</div>
                <div className="text-xs text-muted-foreground">
                  Company: {r.company} • Replied at {new Date(r.replied_at).toLocaleString()}
                </div>
                {campaignName ? (
                  <div className="mt-1 text-xs text-muted-foreground">Campaign: {campaignName}</div>
                ) : null}
                {r.inboxes?.email_address ? (
                  <div className="mt-1 text-xs text-muted-foreground">Received via {r.inboxes.email_address}</div>
                ) : null}
              </div>
              <span className="text-xs px-2 py-1 rounded border border-border text-muted-foreground">
                {current}
              </span>
            </div>

            <div className="text-sm whitespace-pre-wrap">{r.reply_message}</div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => updateInterest(r.id, 'interested')}
                className="text-xs px-3 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 disabled:opacity-60"
              >
                Mark Interested
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => updateInterest(r.id, 'not_interested')}
                className="text-xs px-3 py-1.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 disabled:opacity-60"
              >
                Mark Not Interested
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => updateInterest(r.id, 'unreviewed')}
                className="text-xs px-3 py-1.5 rounded border border-border bg-background text-muted-foreground disabled:opacity-60"
              >
                Reset
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
