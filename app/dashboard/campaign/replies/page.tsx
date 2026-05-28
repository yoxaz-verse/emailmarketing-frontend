import { serverFetch } from '@/lib/server/server-fetch';
import { getAuth } from '@/lib/auth';
import RepliesReviewClient from './RepliesReviewClient';

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
type UnmatchedReply = {
  id: string;
  from_email?: string | null;
  inbox_email?: string | null;
  message_id?: string | null;
  message?: string | null;
  received_at?: string | null;
  scope_match_source?: string | null;
  scope_confidence?: string | null;
};

type RepliesApiResponse = {
  replies: Reply[];
  unmatched: UnmatchedReply[];
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
};

type CampaignOption = { id: string; name: string };
type OperatorOption = {
  id: string;
  label: string;
};
type ReplyCaptureHealth = {
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
};

export default async function OperatorRepliesPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign_id?: string; review_status?: string; operator_id?: string }>;
}) {
  const auth = await getAuth();
  const isAdmin = ['admin', 'superadmin'].includes(String(auth?.role ?? '').toLowerCase());
  const params = await searchParams;
  const campaignId = typeof params.campaign_id === 'string' ? params.campaign_id : '';
  const reviewStatus = typeof params.review_status === 'string' ? params.review_status : 'all';
  const requestedOperatorId = typeof params.operator_id === 'string' ? params.operator_id : '';

  let replies: Reply[] = [];
  let unmatchedReplies: UnmatchedReply[] = [];
  let campaigns: CampaignOption[] = [];
  let operators: OperatorOption[] = [];
  let selectedOperatorId = requestedOperatorId;
  let replyCaptureHealth: ReplyCaptureHealth | null = null;
  let repliesLoadError: string | null = null;

  if (isAdmin) {
    try {
      const rows = await serverFetch<OperatorOption[]>('/operator/replies/operators');
      operators = Array.isArray(rows) ? rows : [];
    } catch {
      operators = [];
    }
    const activeOperatorIds = new Set(operators.map((row) => String(row.id)).filter(Boolean));
    if (!activeOperatorIds.has(selectedOperatorId)) {
      selectedOperatorId = '';
    }
  } else {
    selectedOperatorId = '';
  }

  const query = new URLSearchParams();
  if (campaignId) query.set('campaign_id', campaignId);
  if (reviewStatus && reviewStatus !== 'all') query.set('review_status', reviewStatus);
  if (isAdmin && selectedOperatorId) query.set('operator_id', selectedOperatorId);

  try {
    const response = await serverFetch<RepliesApiResponse>(
      `/operator/replies${query.toString() ? `?${query.toString()}&include_unmatched=true` : '?include_unmatched=true'}`
    );
    replies = Array.isArray(response?.replies) ? response.replies : [];
    unmatchedReplies = Array.isArray(response?.unmatched) ? response.unmatched : [];
  } catch (error: unknown) {
    replies = [];
    unmatchedReplies = [];
    const message = error instanceof Error ? error.message : null;
    repliesLoadError = String(message ?? 'Failed to load replies. Check backend reply capture health.');
  }

  try {
    campaigns = await serverFetch<CampaignOption[]>('/crud/campaigns');
  } catch {
    campaigns = [];
  }

  try {
    replyCaptureHealth = await serverFetch<ReplyCaptureHealth>('/execution/system/reply-capture-health');
  } catch {
    replyCaptureHealth = null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Replies</h2>
      <RepliesReviewClient
        initialReplies={replies}
        unmatchedReplies={unmatchedReplies}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name ?? `Campaign ${String(c.id).slice(0, 8)}` }))}
        operators={operators.map((o) => ({
          id: o.id,
          name: o.label ?? `Operator ${String(o.id).slice(0, 8)}`,
        }))}
        isAdmin={isAdmin}
        selectedCampaignId={campaignId}
        selectedReviewStatus={reviewStatus}
        selectedOperatorId={selectedOperatorId}
        replyCaptureHealth={replyCaptureHealth}
        repliesLoadError={repliesLoadError}
      />
    </div>
  );
}
