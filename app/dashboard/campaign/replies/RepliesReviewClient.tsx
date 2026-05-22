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
  replyCaptureHealth,
  repliesLoadError,
  repliesDiagnostics,
}: {
  initialReplies: Reply[];
  unmatchedReplies: Array<{
    id: string;
    from_email?: string | null;
    inbox_email?: string | null;
    message_id?: string | null;
    message?: string | null;
    received_at?: string | null;
    scope_match_source?: string | null;
    scope_confidence?: string | null;
  }>;
  campaigns: Array<{ id: string; name: string }>;
  operators: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  selectedCampaignId: string;
  selectedReviewStatus: string;
  selectedOperatorId: string;
  replyCaptureHealth?: {
    stale?: boolean;
    last_poll_at?: string | null;
    failed_inbox_count?: number;
    active_inbox_count?: number;
    inboxes?: Array<{
      inbox_email: string;
      connect_ok: boolean;
      auth_ok: boolean;
      mailbox_open_ok: boolean;
      last_error?: string | null;
      last_error_at?: string | null;
    }>;
  } | null;
  repliesLoadError?: string | null;
  repliesDiagnostics?: {
    matched_count?: number;
    unmatched_count?: number;
    mapping_confidence_breakdown?: {
      high?: number;
      medium?: number;
      low?: number;
      unknown?: number;
    };
    worker_health_snapshot?: {
      stale?: boolean;
      failed_inbox_count?: number;
      active_inbox_count?: number;
      last_poll_at?: string | null;
    };
  } | null;
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
      {repliesDiagnostics ? (
        <div className="rounded border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
          Replies diagnostics: matched {Number(repliesDiagnostics.matched_count ?? replies.length)} • unmatched {Number(repliesDiagnostics.unmatched_count ?? unmatched.length)}
          {repliesDiagnostics.mapping_confidence_breakdown
            ? ` • fallback confidence (H/M/L/U): ${Number(repliesDiagnostics.mapping_confidence_breakdown.high ?? 0)}/${Number(repliesDiagnostics.mapping_confidence_breakdown.medium ?? 0)}/${Number(repliesDiagnostics.mapping_confidence_breakdown.low ?? 0)}/${Number(repliesDiagnostics.mapping_confidence_breakdown.unknown ?? 0)}`
            : ''}
        </div>
      ) : null}
      {repliesLoadError ? (
        <div className="rounded border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-200">
          Failed to load replies: {repliesLoadError}
        </div>
      ) : null}
      {replyCaptureHealth?.stale ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          Reply capture worker looks stale. Last poll: {replyCaptureHealth.last_poll_at ? new Date(replyCaptureHealth.last_poll_at).toLocaleString() : 'never'}.
        </div>
      ) : null}
      {(replyCaptureHealth?.failed_inbox_count ?? 0) > 0 ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          Reply capture has inbox failures: {replyCaptureHealth?.failed_inbox_count} failed out of {replyCaptureHealth?.active_inbox_count ?? 0} active inboxes.
          {Array.isArray(replyCaptureHealth?.inboxes)
            ? (
              <ul className="mt-1 list-disc pl-4">
                {replyCaptureHealth.inboxes
                  .filter((inbox) => inbox.last_error)
                  .slice(0, 5)
                  .map((inbox) => (
                    <li key={inbox.inbox_email}>
                      {inbox.inbox_email}: {inbox.last_error}
                    </li>
                  ))}
              </ul>
            )
            : null}
        </div>
      ) : null}
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
      {isAdmin && selectedOperatorId ? (
        <div className="text-xs text-muted-foreground">
          Operator filter is active. Clear operator filter to see replies from all operators.
        </div>
      ) : null}
      {replies.length === 0 && unmatched.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replies yet</p>
      ) : null}
      {unmatched.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Unmatched / Needs Mapping</div>
          {unmatched.map((row) => (
            <div key={row.id} className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <div className="mb-1 inline-flex rounded border border-amber-500/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-amber-300">
                Unmatched (manual map required)
              </div>
              {row.scope_match_source ? (
                <div className="mb-1 text-[11px] text-amber-200/90">
                  Visible via {row.scope_match_source === 'message_id' ? 'message-id match' : 'recipient+time fallback'} ({row.scope_confidence || 'unknown'} confidence)
                </div>
              ) : null}
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
                Matched • {current}
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
