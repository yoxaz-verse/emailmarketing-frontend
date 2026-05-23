'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { mapUnmatchedReplyAction, reviewReplyInterestAction } from './actions';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Mail,
  User,
  Building,
  Clock,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Activity,
  Filter,
  Inbox,
  ChevronDown
} from 'lucide-react';

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
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [expandedUnmatched, setExpandedUnmatched] = useState<Record<string, boolean>>({});

  function toggleReply(id: string) {
    setExpandedReplies((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleUnmatched(id: string) {
    setExpandedUnmatched((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Diagnostics Section */}
      <div className="flex flex-col gap-3">
        {repliesDiagnostics ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary-foreground/80 backdrop-blur-md shadow-sm transition-all hover:bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <span className="font-medium text-primary">Diagnostics: </span>
              matched <span className="font-semibold">{Number(repliesDiagnostics.matched_count ?? replies.length)}</span> • 
              unmatched <span className="font-semibold">{Number(repliesDiagnostics.unmatched_count ?? unmatched.length)}</span>
              {repliesDiagnostics.mapping_confidence_breakdown
                ? ` • fallback confidence (H/M/L/U): ${Number(repliesDiagnostics.mapping_confidence_breakdown.high ?? 0)}/${Number(repliesDiagnostics.mapping_confidence_breakdown.medium ?? 0)}/${Number(repliesDiagnostics.mapping_confidence_breakdown.low ?? 0)}/${Number(repliesDiagnostics.mapping_confidence_breakdown.unknown ?? 0)}`
                : ''}
            </div>
          </div>
        ) : null}

        {repliesLoadError ? (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200 backdrop-blur-md shadow-sm">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <div>Failed to load replies: {repliesLoadError}</div>
          </div>
        ) : null}

        {replyCaptureHealth?.stale ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 backdrop-blur-md shadow-sm">
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
            <div>Reply capture worker looks stale. Last poll: <span className="font-semibold">{replyCaptureHealth.last_poll_at ? new Date(replyCaptureHealth.last_poll_at).toLocaleString() : 'never'}</span>.</div>
          </div>
        ) : null}

        {(replyCaptureHealth?.failed_inbox_count ?? 0) > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 backdrop-blur-md shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>Reply capture has inbox failures: <span className="font-semibold">{replyCaptureHealth?.failed_inbox_count} failed</span> out of {replyCaptureHealth?.active_inbox_count ?? 0} active inboxes.</div>
            </div>
            {Array.isArray(replyCaptureHealth?.inboxes)
              ? (
                <ul className="mt-2 list-none space-y-1 pl-8">
                  {replyCaptureHealth.inboxes
                    .filter((inbox) => inbox.last_error)
                    .slice(0, 5)
                    .map((inbox) => (
                      <li key={inbox.inbox_email} className="flex items-center gap-2 text-xs opacity-80">
                        <Inbox className="h-3 w-3" /> {inbox.inbox_email}: {inbox.last_error}
                      </li>
                    ))}
                </ul>
              )
              : null}
          </div>
        ) : null}
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-card/30 p-3 backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-2 px-2 text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="h-6 w-px bg-border/50"></div>
        
        <div className="relative group">
          <select
            value={selectedCampaignId}
            onChange={(e) => updateFilter({ campaignId: e.target.value })}
            className="h-9 w-40 appearance-none rounded-lg border border-border/50 bg-background/50 px-3 pr-8 text-sm outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/50 group-hover:bg-background/80"
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        <div className="relative group">
          <select
            value={selectedReviewStatus}
            onChange={(e) => updateFilter({ reviewStatus: e.target.value })}
            className="h-9 w-40 appearance-none rounded-lg border border-border/50 bg-background/50 px-3 pr-8 text-sm outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/50 group-hover:bg-background/80"
          >
            <option value="all">All Reviews</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="reviewed">Reviewed</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>

        {isAdmin ? (
          <div className="relative group">
            <select
              value={selectedOperatorId}
              onChange={(e) => updateFilter({ operatorId: e.target.value })}
              className="h-9 w-40 appearance-none rounded-lg border border-border/50 bg-background/50 px-3 pr-8 text-sm outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/50 group-hover:bg-background/80"
            >
              <option value="">All Operators</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        ) : null}

        {isAdmin && selectedOperatorId ? (
          <div className="ml-auto flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            <User className="h-3 w-3" />
            Operator filter active
          </div>
        ) : null}
      </div>

      {replies.length === 0 && unmatched.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card/20 py-20 backdrop-blur-sm">
          <Inbox className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No replies found</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Try adjusting your filters or check back later.</p>
        </div>
      ) : null}

      {/* Unmatched Replies */}
      {unmatched.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-500/80">Needs Mapping</div>
            <div className="h-px flex-1 bg-amber-500/20"></div>
            <div className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500">{unmatched.length}</div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {unmatched.map((row, idx) => {
              const isExpanded = !!expandedUnmatched[row.id];
              return (
                <div key={`unmatched-${row.id}-${row.received_at ?? 'na'}-${idx}`} className="group flex flex-col overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-5 transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
                  <div
                    onClick={() => toggleUnmatched(row.id)}
                    className="flex cursor-pointer items-start justify-between gap-4 select-none"
                  >
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-foreground/80">
                        <User className="h-4 w-4 text-amber-500/70 shrink-0" />
                        <span className="font-semibold truncate">{row.from_email || 'Unknown sender'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Inbox className="h-3 w-3" /> {row.inbox_email || 'unknown inbox'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {row.received_at ? new Date(row.received_at).toLocaleString() : 'unknown time'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                        Map Required
                      </span>
                      <ChevronDown className={`h-4 w-4 text-amber-500/60 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                    <div className="overflow-hidden space-y-4">
                      {row.scope_match_source ? (
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-background/50 px-2 py-1 text-[11px] text-amber-400 backdrop-blur-sm">
                          <Activity className="h-3 w-3" />
                          Visible via {row.scope_match_source === 'message_id' ? 'message-id match' : 'recipient+time fallback'} ({row.scope_confidence || 'unknown'} confidence)
                        </div>
                      ) : null}

                      <div className="relative rounded-xl border border-amber-500/10 bg-background/40 p-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words backdrop-blur-md shadow-inner max-h-48 overflow-y-auto">
                        <MessageSquare className="absolute right-3 top-3 h-4 w-4 opacity-10" />
                        {row.message || '(no message body)'}
                      </div>
                      
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-500 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            mapUnmatched(row.id, row.from_email);
                          }}
                          disabled={isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Map By Sender Email
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Matched Replies */}
      {replies.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pt-2">
            <div className="text-xs font-bold uppercase tracking-widest text-primary/80">Matched Replies</div>
            <div className="h-px flex-1 bg-border/50"></div>
            <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{replies.length}</div>
          </div>
          
          <div className="grid gap-4">
            {replies.map((r, idx) => {
              const current = r.interest_status ?? 'unreviewed';
              const disabled = isPending && busyLeadId === r.id;
              const campaignName = r.campaign_leads?.[0]?.campaigns?.name;
              const isExpanded = !!expandedReplies[r.id];
              
              const statusColors = {
                interested: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                not_interested: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
                unreviewed: 'border-border bg-background text-muted-foreground'
              };

              return (
                <div key={`reply-${r.id}-${r.replied_at ?? 'na'}-${idx}`} className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/30 p-5 backdrop-blur-xl transition-all hover:border-border/80 hover:shadow-xl hover:shadow-black/5">
                  
                  {/* Header Row */}
                  <div
                    onClick={() => toggleReply(r.id)}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary ring-2 ring-primary/20">
                        {r.first_name ? r.first_name.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                      </div>
                      <div className="overflow-hidden min-w-[150px]">
                        <div className="truncate font-semibold text-foreground text-sm">{r.first_name || 'Unknown'}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                      </div>
                    </div>

                    {/* Message Preview (Only visible when collapsed) */}
                    {!isExpanded && (
                      <div className="flex-1 min-w-0 text-xs text-muted-foreground truncate opacity-70 hidden md:block">
                        {r.reply_message}
                      </div>
                    )}

                    <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0">
                      <span className="text-xs text-muted-foreground hidden lg:flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(r.replied_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusColors[current]}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${current === 'interested' ? 'bg-emerald-400' : current === 'not_interested' ? 'bg-rose-400' : 'bg-muted-foreground'}`} />
                        {current.replace('_', ' ')}
                      </span>
                      
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expandable Body */}
                  <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-border/20' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                    <div className="overflow-hidden flex flex-col md:flex-row gap-5">
                      
                      {/* Left side: Detailed Meta */}
                      <div className="flex flex-col gap-2.5 w-full md:w-60 shrink-0">
                        <div className="space-y-2 rounded-xl bg-background/40 p-3 text-xs border border-border/20">
                          {r.company && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Building className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                              <span className="font-medium text-foreground truncate">{r.company}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                            <span className="truncate">{new Date(r.replied_at).toLocaleString()}</span>
                          </div>
                          {campaignName && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Activity className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                              <span className="truncate">{campaignName}</span>
                            </div>
                          )}
                          {r.inboxes?.email_address && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Inbox className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                              <span className="truncate">{r.inboxes.email_address}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right side: Message Content & Actions */}
                      <div className="flex-1 flex flex-col justify-between gap-4">
                        <div className="relative flex-1 rounded-xl border border-border/50 bg-background/50 p-4 shadow-sm">
                          <Mail className="absolute right-4 top-4 h-5 w-5 text-muted-foreground/20" />
                          <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                            {r.reply_message}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateInterest(r.id, 'interested');
                            }}
                            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-all ${
                              current === 'interested' 
                                ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10'
                            } disabled:opacity-50`}
                          >
                            <ThumbsUp className="h-4 w-4" />
                            Interested
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateInterest(r.id, 'not_interested');
                            }}
                            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-all ${
                              current === 'not_interested' 
                                ? 'border-rose-500 bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
                                : 'border-rose-500/30 bg-rose-500/5 text-rose-500 hover:bg-rose-500/10'
                            } disabled:opacity-50`}
                          >
                            <ThumbsDown className="h-4 w-4" />
                            Not Interested
                          </button>
                          {(current === 'interested' || current === 'not_interested') && (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateInterest(r.id, 'unreviewed');
                              }}
                              className="inline-flex items-center justify-center rounded-lg border border-border/50 bg-background/50 p-2 text-muted-foreground transition-all hover:bg-background hover:text-foreground disabled:opacity-50"
                              title="Reset Status"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
