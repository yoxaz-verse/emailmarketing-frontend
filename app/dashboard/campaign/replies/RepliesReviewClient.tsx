'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { mapUnmatchedReplyAction, reviewReplyInterestAction } from './actions';

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

export default function RepliesReviewClient({
  initialReplies,
  unmatchedReplies,
  campaigns,
  operators,
  isAdmin,
  selectedCampaignId,
  selectedReviewStatus,
  selectedOperatorId,
}: {
  initialReplies: Reply[];
  unmatchedReplies: Array<{
    id: string;
    from_email?: string | null;
    inbox_email?: string | null;
    message_id?: string | null;
    message?: string | null;
    received_at?: string | null;
  }>;
  campaigns: Array<{ id: string; name: string }>;
  operators: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  selectedCampaignId: string;
  selectedReviewStatus: string;
  selectedOperatorId: string;
}) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [unmatched, setUnmatched] = useState(unmatchedReplies);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function updateFilter(next: { campaignId?: string; reviewStatus?: string; operatorId?: string }) {
    const query = new URLSearchParams();
    const campaignId = next.campaignId ?? selectedCampaignId;
    const reviewStatus = next.reviewStatus ?? selectedReviewStatus;
    const operatorId = next.operatorId ?? selectedOperatorId;
    if (campaignId) query.set('campaign_id', campaignId);
    if (reviewStatus && reviewStatus !== 'all') query.set('review_status', reviewStatus);
    if (isAdmin && operatorId) query.set('operator_id', operatorId);
    const url = query.toString() ? `${pathname}?${query.toString()}` : pathname;
    router.push(url);
  }

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

  function mapUnmatched(replyEventId: string, fromEmail?: string | null) {
    const leadEmail = String(fromEmail ?? '').trim().toLowerCase();
    if (!leadEmail) return;
    startTransition(async () => {
      try {
        const leadId = replies.find((row) => String(row.email ?? '').toLowerCase() === leadEmail)?.id;
        await mapUnmatchedReplyAction({ replyEventId, lead_id: leadId, lead_email: leadEmail });
        setUnmatched((prev) => prev.filter((row) => row.id !== replyEventId));
      } catch {
        // keep list as-is on failure
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedCampaignId}
          onChange={(e) => updateFilter({ campaignId: e.target.value })}
          className="h-9 rounded border border-border bg-background px-2 text-sm"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={selectedReviewStatus}
          onChange={(e) => updateFilter({ reviewStatus: e.target.value })}
          className="h-9 rounded border border-border bg-background px-2 text-sm"
        >
          <option value="all">All Reviews</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="reviewed">Reviewed</option>
        </select>
        {isAdmin ? (
          <select
            value={selectedOperatorId}
            onChange={(e) => updateFilter({ operatorId: e.target.value })}
            className="h-9 rounded border border-border bg-background px-2 text-sm"
          >
            <option value="">All Operators</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        ) : null}
      </div>
      {replies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replies yet</p>
      ) : null}
      {unmatched.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Unmatched / Needs Mapping</div>
          {unmatched.map((row) => (
            <div key={row.id} className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <div className="text-xs text-muted-foreground">
                From {row.from_email || 'unknown'} via {row.inbox_email || 'unknown inbox'} at {row.received_at ? new Date(row.received_at).toLocaleString() : 'unknown time'}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{row.message || '(no message body)'}</div>
              <button
                type="button"
                className="mt-2 text-xs px-2 py-1 rounded border border-border bg-background"
                onClick={() => mapUnmatched(row.id, row.from_email)}
                disabled={isPending}
              >
                Map By Sender Email
              </button>
            </div>
          ))}
        </div>
      ) : null}
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
