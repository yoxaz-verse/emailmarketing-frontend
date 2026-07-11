'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { TemplatePicker } from '@/components/content-templates/TemplatePicker';
import { clientFetch } from '@/lib/client-fetch';
import {
  SOCIAL_POST_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
  SocialPostTemplate,
} from './socialPostTemplates';

type PlatformCode = 'meta' | 'linkedin' | 'reddit' | 'telegram' | 'whatsapp';
type CalendarView = 'month' | 'week';
type DialogMode = 'create' | 'edit';
type DialogStep = 1 | 2 | 3;

type Operator = { id: string; name: string; region?: string | null };
type ConnectorStatus = 'connected' | 'expired' | 'missing_scope' | 'disconnected';
type SocialConnection = {
  platform_code: string;
  status: ConnectorStatus;
  reason: string | null;
  scopes: string[];
  expires_at: string | null;
  metadata: Record<string, unknown>;
};
type SocialConnector = {
  code: PlatformCode;
  name: string;
  can_schedule: boolean;
  can_publish: boolean;
  credentials_active: boolean;
  metadata: Record<string, unknown>;
};
type BackendJob = {
  id: string;
  request_id: string;
  platform_code: PlatformCode;
  status: 'scheduled' | 'draft_created' | 'validated' | 'approval_pending' | 'manual_action_required' | 'published' | 'failed';
  phase: string;
  post_input: {
    content?: string;
    media?: string[];
    cta_url?: string;
    hashtags?: string[];
    timezone?: string;
    scheduled_at?: string | null;
  };
  scheduled_at: string | null;
  operator_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  error_message?: string | null;
  provider_error_message?: string | null;
  social_publish_requests?: {
    id: string;
    operator_id?: string | null;
    targets?: PlatformCode[];
    post_input?: BackendJob['post_input'];
  } | null;
};
type ScheduledSocialPost = {
  id: string;
  requestId: string;
  jobIds: string[];
  content: string;
  platforms: PlatformCode[];
  ctaUrl?: string;
  hashtags: string[];
  media: string[];
  scheduledAtUtc: string;
  timezone: 'Asia/Kolkata';
  status: BackendJob['status'];
  createdAt: string;
  operatorId?: string | null;
  error?: string | null;
};
type ComposerDraft = {
  scheduledDate: string;
  scheduledTime: string;
  platforms: Record<PlatformCode, boolean>;
  content: string;
  ctaUrl: string;
  hashtagsCsv: string;
  mediaCsv: string;
};
type PlatformReadiness = {
  ready: boolean;
  status: 'ready' | 'select_operator' | 'unknown_platform' | 'not_schedulable' | 'not_publishable' | 'unconfigured' | ConnectorStatus;
  message: string;
  missingFields: string[];
};

const IST_TIMEZONE = 'Asia/Kolkata';
const PLATFORM_LABELS: Record<PlatformCode, string> = {
  meta: 'Meta',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};
const PLATFORM_COLORS: Record<PlatformCode, string> = {
  meta: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/30',
  linkedin: 'bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:bg-cyan-600/20 dark:text-cyan-300 dark:border-cyan-500/30',
  reddit: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30 dark:bg-orange-600/20 dark:text-orange-300 dark:border-orange-500/30',
  telegram: 'bg-sky-500/15 text-sky-700 border-sky-500/30 dark:bg-sky-600/20 dark:text-sky-500 dark:border-sky-500/30',
  whatsapp: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30 dark:bg-green-600/20 dark:text-green-300 dark:border-green-500/30',
};
const STATUS_LABELS: Record<ScheduledSocialPost['status'], string> = {
  scheduled: 'Scheduled',
  draft_created: 'Queued',
  validated: 'Validated',
  approval_pending: 'Queued',
  manual_action_required: 'Manual',
  published: 'Published',
  failed: 'Failed',
};
const STATUS_BADGES: Record<ScheduledSocialPost['status'], string> = {
  scheduled: 'bg-blue-600 text-white',
  draft_created: 'bg-slate-600 text-white',
  validated: 'bg-slate-600 text-white',
  approval_pending: 'bg-slate-600 text-white',
  manual_action_required: 'bg-amber-600 text-white',
  published: 'bg-green-600 text-white',
  failed: 'bg-red-600 text-white',
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function startOfWeek(date: Date): Date {
  const day = date.getDay();
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), day === 0 ? -6 : 1 - day);
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function toTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function composeLocalDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const local = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(local.getTime()) ? null : local;
}
function isStrictlyFutureDateTime(dateStr: string, timeStr: string): boolean {
  const scheduled = composeLocalDateTime(dateStr, timeStr);
  return Boolean(scheduled && scheduled.getTime() > Date.now());
}
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
}
function buildQuarterHourOptions(): string[] {
  const values: string[] = [];
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 15) values.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return values;
}
function defaultDraftForDate(date: Date): ComposerDraft {
  return {
    scheduledDate: toDateInput(date),
    scheduledTime: toTimeInput(date),
    platforms: { meta: false, linkedin: true, reddit: false, telegram: false, whatsapp: false },
    content: '',
    ctaUrl: '',
    hashtagsCsv: '',
    mediaCsv: '',
  };
}
function createDraftFromPost(post: ScheduledSocialPost): ComposerDraft {
  const dt = new Date(post.scheduledAtUtc);
  const selected: Record<PlatformCode, boolean> = { meta: false, linkedin: false, reddit: false, telegram: false, whatsapp: false };
  for (const p of post.platforms) selected[p] = true;
  return {
    scheduledDate: toDateInput(dt),
    scheduledTime: toTimeInput(dt),
    platforms: selected,
    content: post.content,
    ctaUrl: post.ctaUrl ?? '',
    hashtagsCsv: post.hashtags.join(','),
    mediaCsv: post.media.join(','),
  };
}
function getSelectedPlatforms(platforms: Record<PlatformCode, boolean>): PlatformCode[] {
  return (Object.keys(platforms) as PlatformCode[]).filter((p) => platforms[p]);
}
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}
function connectorMissingFields(connector?: SocialConnector | null): string[] {
  const metadata = connector?.metadata && typeof connector.metadata === 'object' ? connector.metadata : {};
  return asStringArray((metadata as Record<string, unknown>).missing_fields);
}
function connectorAppConfigured(connector?: SocialConnector | null): boolean {
  if (!connector) return false;
  const metadata = connector.metadata && typeof connector.metadata === 'object' ? connector.metadata : {};
  const appConfigured = (metadata as Record<string, unknown>).app_configured;
  const oauthAppConfigured = (metadata as Record<string, unknown>).oauth_app_configured;
  if (appConfigured === false || oauthAppConfigured === false) return false;
  return connectorMissingFields(connector).length === 0;
}
function getPlatformReadiness(
  platform: PlatformCode,
  connectors: SocialConnector[],
  connections: SocialConnection[],
  selectedOperatorId: string,
  isAdmin: boolean
): PlatformReadiness {
  const label = PLATFORM_LABELS[platform];
  if (isAdmin && !selectedOperatorId) {
    return {
      ready: false,
      status: 'select_operator',
      message: 'Select an operator before scheduling.',
      missingFields: [],
    };
  }

  const connector = connectors.find((c) => c.code === platform);
  if (!connector) {
    return {
      ready: false,
      status: 'unknown_platform',
      message: `${label} connector is not configured in backend.`,
      missingFields: [],
    };
  }

  if (!connector.can_schedule) {
    return {
      ready: false,
      status: 'not_schedulable',
      message: `${label} connector cannot schedule posts yet.`,
      missingFields: [],
    };
  }

  if (!connector.can_publish) {
    return {
      ready: false,
      status: 'not_publishable',
      message: `${label} connector cannot publish posts yet.`,
      missingFields: [],
    };
  }

  if (!connectorAppConfigured(connector)) {
    const missingFields = connectorMissingFields(connector);
    return {
      ready: false,
      status: 'unconfigured',
      message: missingFields.length > 0
        ? `${label} app credentials are incomplete: ${missingFields.join(', ')}.`
        : `${label} app credentials are not configured.`,
      missingFields,
    };
  }

  const connection = connections.find((c) => c.platform_code === platform);
  if (!connection) {
    return {
      ready: false,
      status: 'disconnected',
      message: `${label} is not connected for this operator.`,
      missingFields: [],
    };
  }

  if (connection.status !== 'connected') {
    return {
      ready: false,
      status: connection.status,
      message: connection.reason || `${label} status: ${connection.status}.`,
      missingFields: [],
    };
  }

  return {
    ready: true,
    status: 'ready',
    message: `${label} connected and ready to schedule.`,
    missingFields: [],
  };
}
function rollupStatus(statuses: BackendJob['status'][]): ScheduledSocialPost['status'] {
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('manual_action_required')) return 'manual_action_required';
  if (statuses.includes('scheduled')) return 'scheduled';
  if (statuses.every((s) => s === 'published')) return 'published';
  if (statuses.includes('approval_pending')) return 'approval_pending';
  if (statuses.includes('validated')) return 'validated';
  return statuses[0] ?? 'draft_created';
}
function normalizeJobs(jobs: BackendJob[]): ScheduledSocialPost[] {
  const grouped = new Map<string, BackendJob[]>();
  for (const job of jobs) {
    const key = job.request_id || job.id;
    grouped.set(key, [...(grouped.get(key) ?? []), job]);
  }

  return Array.from(grouped.entries()).map(([requestId, rows]) => {
    const first = rows[0];
    const requestInput = first?.social_publish_requests?.post_input;
    const postInput = requestInput ?? first?.post_input ?? {};
    const scheduledAt = String(postInput.scheduled_at ?? first?.scheduled_at ?? first?.created_at ?? new Date().toISOString());
    const requestTargets = first?.social_publish_requests?.targets;
    const targetRows = Array.isArray(requestTargets) && requestTargets.length > 0
      ? rows.filter((row) => requestTargets.includes(row.platform_code))
      : rows;
    const platforms = Array.from(new Set(targetRows.map((row) => row.platform_code).filter(Boolean))) as PlatformCode[];
    const errors = targetRows.map((row) => row.provider_error_message || row.error_message).filter(Boolean);
    return {
      id: requestId,
      requestId,
      jobIds: targetRows.map((row) => row.id),
      content: String(postInput.content ?? ''),
      platforms,
      ctaUrl: postInput.cta_url || undefined,
      hashtags: Array.isArray(postInput.hashtags) ? postInput.hashtags.map(String) : [],
      media: Array.isArray(postInput.media) ? postInput.media.map(String) : [],
      scheduledAtUtc: scheduledAt,
      timezone: 'Asia/Kolkata',
      status: rollupStatus(targetRows.map((row) => row.status)),
      createdAt: first?.created_at ?? new Date().toISOString(),
      operatorId: first?.operator_id ?? first?.social_publish_requests?.operator_id ?? null,
      error: errors[0] ?? null,
    };
  });
}
export default function SocialSchedulingClient({
  role,
  operators = [],
  operatorLoadError,
}: {
  role?: string;
  operators?: Operator[];
  operatorLoadError?: string;
}) {
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [posts, setPosts] = useState<ScheduledSocialPost[]>([]);
  const [connectors, setConnectors] = useState<SocialConnector[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [dialogStep, setDialogStep] = useState<DialogStep>(1);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [draft, setDraft] = useState<ComposerDraft>(defaultDraftForDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const quarterHourOptions = useMemo(() => buildQuarterHourOptions(), []);
  const today = useMemo(() => new Date(), []);
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const weekStart = startOfWeek(anchorDate);
  const selectedPlatforms = useMemo(() => getSelectedPlatforms(draft.platforms), [draft.platforms]);
  const templateCategories = useMemo(
    () => Object.entries(TEMPLATE_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    []
  );
  const contentCharacterCount = draft.content.length;
  const selectedPlatformHint = selectedPlatforms.length > 0
    ? selectedPlatforms.map((platform) => PLATFORM_LABELS[platform]).join(', ')
    : 'No platforms selected';
  const readinessByPlatform = useMemo(() => {
    return (Object.keys(PLATFORM_LABELS) as PlatformCode[]).reduce((acc, platform) => {
      acc[platform] = getPlatformReadiness(platform, connectors, connections, selectedOperatorId, isAdmin);
      return acc;
    }, {} as Record<PlatformCode, PlatformReadiness>);
  }, [connections, connectors, isAdmin, selectedOperatorId]);
  const readyPlatforms = useMemo(
    () => (Object.keys(readinessByPlatform) as PlatformCode[]).filter((platform) => readinessByPlatform[platform].ready),
    [readinessByPlatform]
  );
  const selectedReadinessIssues = useMemo(
    () => selectedPlatforms
      .map((platform) => readinessByPlatform[platform])
      .filter((item) => !item.ready),
    [readinessByPlatform, selectedPlatforms]
  );
  const hasAnyReadyPlatform = readyPlatforms.length > 0;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = isAdmin && selectedOperatorId ? `?operator_id=${encodeURIComponent(selectedOperatorId)}` : '';
      const connectorQuery = isAdmin && selectedOperatorId ? query : '';
      const [jobsData, connectorData, connectionData] = await Promise.all([
        clientFetch<BackendJob[]>(`/social/publish-jobs${query ? `${query}&limit=300` : '?limit=300'}`),
        clientFetch<SocialConnector[]>(`/social/connectors${connectorQuery}`),
        isAdmin && !selectedOperatorId ? Promise.resolve([] as SocialConnection[]) : clientFetch<SocialConnection[]>(`/social/connections${query}`),
      ]);
      setPosts(normalizeJobs(jobsData ?? []));
      setConnectors(connectorData ?? []);
      setConnections(connectionData ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load social schedules');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedOperatorId]);

  useEffect(() => {
    if (isAdmin && !selectedOperatorId && operators.length === 1) {
      setSelectedOperatorId(String(operators[0]?.id ?? ''));
    }
  }, [isAdmin, operators, selectedOperatorId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const monthGridDays = useMemo(() => {
    const start = startOfWeek(monthStart);
    const end = addDays(startOfWeek(monthEnd), 6);
    const days: Date[] = [];
    let cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [monthStart, monthEnd]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledSocialPost[]>();
    for (const post of posts) {
      const d = new Date(post.scheduledAtUtc);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);
  const upcoming = useMemo(() => {
    return [...posts]
      .filter((post) => new Date(post.scheduledAtUtc).getTime() >= Date.now() || post.status !== 'published')
      .sort((a, b) => new Date(a.scheduledAtUtc).getTime() - new Date(b.scheduledAtUtc).getTime())
      .slice(0, 5);
  }, [posts]);
  const schedulePreview = useMemo(() => {
    const local = composeLocalDateTime(draft.scheduledDate, draft.scheduledTime);
    if (!local) return 'Select date and time';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(local);
  }, [draft.scheduledDate, draft.scheduledTime]);
  const disabledTimeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const opt of quarterHourOptions) {
      if (!isStrictlyFutureDateTime(draft.scheduledDate, opt)) values.add(opt);
    }
    return values;
  }, [draft.scheduledDate, quarterHourOptions]);

  const openComposerForDate = (date: Date) => {
    if (isAdmin && !selectedOperatorId) {
      setError('Select an operator before scheduling.');
      return;
    }
    const prefill = new Date(date);
    if (prefill.getHours() === 0 && prefill.getMinutes() === 0) prefill.setHours(10, 0, 0, 0);
    setDialogMode('create');
    setDialogStep(1);
    setActivePostId(null);
    setSelectedTemplateId(null);
    const nextDraft = defaultDraftForDate(prefill);
    if (!readinessByPlatform.linkedin.ready) {
      nextDraft.platforms = { meta: false, linkedin: false, reddit: false, telegram: false, whatsapp: false };
      const firstReady = readyPlatforms[0];
      if (firstReady) nextDraft.platforms[firstReady] = true;
    }
    setDraft(nextDraft);
    setComposerOpen(true);
    setError(null);
    setSuccess(null);
  };
  const openComposerForEdit = (post: ScheduledSocialPost) => {
    setDialogMode('edit');
    setDialogStep(2);
    setActivePostId(post.requestId);
    setSelectedTemplateId(null);
    setDraft(createDraftFromPost(post));
    setComposerOpen(true);
    setError(null);
    setSuccess(null);
  };
  const validateStepOne = (): boolean => {
    if (isAdmin && !selectedOperatorId) {
      setError('Select an operator first.');
      return false;
    }
    if (!composeLocalDateTime(draft.scheduledDate, draft.scheduledTime)) {
      setError('Please select a valid date and time.');
      return false;
    }
    if (!isStrictlyFutureDateTime(draft.scheduledDate, draft.scheduledTime)) {
      setError('scheduled_at must be in the future');
      return false;
    }
    if (selectedPlatforms.length === 0) {
      setError('Select at least one platform.');
      return false;
    }
    if (selectedReadinessIssues.length > 0) {
      setError(selectedReadinessIssues.map((item) => item.message).join(' '));
      return false;
    }
    setError(null);
    return true;
  };
  const savePost = async () => {
    setError(null);
    setSuccess(null);
    const local = composeLocalDateTime(draft.scheduledDate, draft.scheduledTime);
    if (!local || !validateStepOne()) return;
    if (!draft.content.trim()) {
      setError('Post content is required.');
      return;
    }
    setSaving(true);
    try {
      const platforms = getSelectedPlatforms(draft.platforms);
      const payload = {
        targets: platforms,
        post_input: {
          content: draft.content.trim(),
          media: draft.mediaCsv.split(',').map((s) => s.trim()).filter(Boolean),
          cta_url: draft.ctaUrl.trim() || undefined,
          hashtags: draft.hashtagsCsv.split(',').map((s) => s.trim()).filter(Boolean),
          timezone: IST_TIMEZONE,
          scheduled_at: local.toISOString(),
        },
        ...(isAdmin ? { operator_id: selectedOperatorId } : {}),
      };
      if (dialogMode === 'edit' && activePostId) {
        await clientFetch(`/social/publish-requests/${encodeURIComponent(activePostId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await clientFetch('/social/publish-jobs', {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            idempotency_key: `social-calendar-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          }),
        });
      }
      setComposerOpen(false);
      setActivePostId(null);
      setSuccess('Schedule saved.');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };
  const changeAnchor = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setAnchorDate(new Date());
      return;
    }
    const d = new Date(anchorDate);
    if (view === 'month') d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
    else d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
    setAnchorDate(d);
  };
  const applyPreset = (minutes: number) => {
    const base = new Date(Date.now() + minutes * 60_000);
    base.setMinutes(Math.ceil(base.getMinutes() / 15) * 15, 0, 0);
    setDraft((prev) => ({ ...prev, scheduledDate: toDateInput(base), scheduledTime: toTimeInput(base) }));
  };
  const applyTemplate = (template: SocialPostTemplate) => {
    const nextPlatforms: Record<PlatformCode, boolean> = {
      meta: false,
      linkedin: false,
      reddit: false,
      telegram: false,
      whatsapp: false,
    };
    const unavailable = template.platforms.filter((platform) => !readinessByPlatform[platform].ready);
    for (const platform of template.platforms) {
      if (readinessByPlatform[platform].ready) nextPlatforms[platform] = true;
    }

    setSelectedTemplateId(template.id);
    setDraft((prev) => ({
      ...prev,
      platforms: nextPlatforms,
      content: template.content,
      hashtagsCsv: template.hashtags.join(','),
      ctaUrl: template.ctaUrlPlaceholder ?? prev.ctaUrl,
    }));
    setError(unavailable.length > 0
      ? `${unavailable.map((platform) => PLATFORM_LABELS[platform]).join(', ')} not selected because the platform is not ready.`
      : null);
  };
  const renderPostChip = (post: ScheduledSocialPost) => {
    const date = new Date(post.scheduledAtUtc);
    return (
      <div
        key={post.id}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          openComposerForEdit(post);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openComposerForEdit(post);
          }
        }}
        className="w-full cursor-pointer rounded border border-border/60 bg-muted/40 px-2 py-1 text-left text-xs hover:border-blue-400/60 dark:bg-white/5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{formatTime(date)}</span>
          <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_BADGES[post.status]}`}>{STATUS_LABELS[post.status]}</Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{post.content || '(No content)'}</p>
        {post.error && <p className="mt-1 line-clamp-1 text-[10px] text-red-600">{post.error}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Social Scheduling Calendar</h2>
          <p className="text-sm text-muted-foreground">Persisted scheduling in IST with LinkedIn auto-publish when due.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publishing Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAdmin && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Operator</span>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm md:max-w-md"
                value={selectedOperatorId}
                onChange={(e) => {
                  setSelectedOperatorId(e.target.value);
                  setPosts([]);
                }}
              >
                <option value="">Select operator</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}{operator.region ? ` (${operator.region})` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {operatorLoadError && <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-200">{operatorLoadError}</div>}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {(Object.keys(PLATFORM_LABELS) as PlatformCode[]).map((platform) => {
              const readiness = readinessByPlatform[platform];
              return (
                <div
                  key={platform}
                  className={`rounded border p-2 text-sm ${readiness.ready ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{PLATFORM_LABELS[platform]}</span>
                    <Badge className={readiness.ready ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}>
                      {readiness.ready ? 'Ready' : 'Not ready'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs">{readiness.message}</p>
                  {readiness.missingFields.length > 0 && (
                    <p className="mt-1 text-[11px] opacity-80">Missing: {readiness.missingFields.join(', ')}</p>
                  )}
                </div>
              );
            })}
          </div>
          {!hasAnyReadyPlatform && !loading && (
            <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-300">
              No connected publishing platform is ready. Scheduling is blocked until at least one platform is connected and configured.
            </div>
          )}
          {success && <div className="rounded border border-green-500/30 bg-green-500/10 p-2 text-sm text-green-700 dark:text-green-300">{success}</div>}
          {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <CardTitle>Calendar</CardTitle>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="inline-flex rounded-md border border-border/60 p-1">
                <Button size="sm" variant={view === 'month' ? 'default' : 'ghost'} onClick={() => setView('month')}>Month</Button>
                <Button size="sm" variant={view === 'week' ? 'default' : 'ghost'} onClick={() => setView('week')}>Week</Button>
              </div>
              <Button size="sm" variant="outline" aria-label="Previous period" onClick={() => changeAnchor('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => changeAnchor('today')}>Today</Button>
              <Button size="sm" variant="outline" aria-label="Next period" onClick={() => changeAnchor('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <p className="text-sm font-medium">
                {view === 'month'
                  ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(anchorDate)
                  : `${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(weekStart)} - ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(addDays(weekStart, 6))}`}
              </p>
              <Button size="sm" className="ml-auto" onClick={() => openComposerForDate(new Date())}>+ Schedule Post</Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{IST_TIMEZONE}</p>
        </CardHeader>
        <CardContent>
          {view === 'month' ? (
            <div className="grid grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="px-2 py-1 text-xs font-semibold text-muted-foreground">{d}</div>)}
              {monthGridDays.map((day) => {
                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                const dayPosts = postsByDay.get(key) ?? [];
                const disabled = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59).getTime() <= Date.now();
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => openComposerForDate(day)}
                    className={`min-h-[130px] rounded-lg border p-2 text-left transition ${disabled ? 'cursor-not-allowed border-red-400/60 bg-rose-500/10' : 'border-border/60 bg-muted/40 hover:border-blue-400/60 dark:bg-white/5'} ${isSameDay(day, today) ? 'ring-1 ring-blue-500/70' : ''}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{day.getDate()}</span>
                      {isSameDay(day, today) && <Badge className="bg-blue-600 text-white">Today</Badge>}
                    </div>
                    <div className="space-y-1">
                      {dayPosts.slice(0, 2).map(renderPostChip)}
                      {dayPosts.length > 2 && <p className="text-[11px] text-muted-foreground">+{dayPosts.length - 2} more</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-8 gap-2">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Time</div>
                {weekDays.map((d) => <div key={d.toISOString()} className="rounded px-2 py-1 text-xs font-semibold text-muted-foreground">{new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)}</div>)}
              </div>
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="grid grid-cols-8 gap-2">
                  <div className="px-2 py-2 text-xs text-muted-foreground">{String(hour).padStart(2, '0')}:00</div>
                  {weekDays.map((d) => {
                    const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0);
                    const key = `${slot.getFullYear()}-${slot.getMonth()}-${slot.getDate()}`;
                    const dayPosts = (postsByDay.get(key) ?? []).filter((p) => new Date(p.scheduledAtUtc).getHours() === hour);
                    const disabled = slot.getTime() <= Date.now();
                    return (
                      <button
                        key={slot.toISOString()}
                        type="button"
                        disabled={disabled}
                        onClick={() => openComposerForDate(slot)}
                        className={`min-h-[64px] rounded border p-1 text-left ${disabled ? 'cursor-not-allowed border-red-400/60 bg-rose-500/10' : 'border-border/60 bg-muted/40 hover:border-blue-400/60 dark:bg-white/5'}`}
                      >
                        {dayPosts.length === 0 ? <span className="text-[10px] text-muted-foreground">+ schedule</span> : dayPosts.slice(0, 1).map(renderPostChip)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming (Next 5)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No scheduled posts yet.</p>}
          {upcoming.map((post) => (
            <div key={post.id} className="rounded border border-border/60 bg-muted/40 p-3 dark:bg-white/5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.scheduledAtUtc))}</p>
                <Badge className={STATUS_BADGES[post.status]}>{STATUS_LABELS[post.status]}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.content || '(No content)'}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {post.platforms.map((platform) => <span key={`${post.id}-${platform}`} className={`rounded border px-1.5 py-0.5 text-[10px] ${PLATFORM_COLORS[platform]}`}>{PLATFORM_LABELS[platform]}</span>)}
              </div>
              {post.error && <p className="mt-2 text-xs text-red-600">{post.error}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border/60 bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{dialogMode === 'edit' ? 'Edit Scheduled Post' : 'Create Scheduled Post'}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{schedulePreview} | {selectedPlatformHint} | {IST_TIMEZONE}</p>
              </div>
              <Button variant="ghost" onClick={() => setComposerOpen(false)}>Close</Button>
            </div>
            <div className="mb-4 inline-flex rounded-md border border-border/60 p-1">
              <Button size="sm" variant={dialogStep === 1 ? 'default' : 'ghost'} onClick={() => setDialogStep(1)}>1. Schedule</Button>
              <Button size="sm" variant={dialogStep === 2 ? 'default' : 'ghost'} onClick={() => setDialogStep(2)}>2. Templates</Button>
              <Button size="sm" variant={dialogStep === 3 ? 'default' : 'ghost'} onClick={() => setDialogStep(3)}>3. Content</Button>
            </div>
            {error && <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
            {dialogStep === 1 ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs text-muted-foreground">Date</span>
                    <Input type="date" value={draft.scheduledDate} min={toDateInput(new Date())} onChange={(e) => setDraft((prev) => ({ ...prev, scheduledDate: e.target.value }))} />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-muted-foreground">Time (15-min slots)</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.scheduledTime} onChange={(e) => setDraft((prev) => ({ ...prev, scheduledTime: e.target.value }))}>
                      {quarterHourOptions.map((opt) => <option key={opt} value={opt} disabled={disabledTimeOptions.has(opt)}>{disabledTimeOptions.has(opt) ? `${opt} (past)` : opt}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => applyPreset(15)}>Next slot</Button>
                  <Button size="sm" variant="outline" onClick={() => applyPreset(30)}>+30m</Button>
                  <Button size="sm" variant="outline" onClick={() => applyPreset(60)}>+1h</Button>
                  <Button size="sm" variant="outline" onClick={() => applyPreset(24 * 60)}>Tomorrow</Button>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Platforms</p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {(Object.keys(PLATFORM_LABELS) as PlatformCode[]).map((platform) => {
                      const readiness = readinessByPlatform[platform];
                      return (
                        <label
                          key={platform}
                          className={`rounded border p-2 text-sm ${readiness.ready ? 'border-border/60' : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'}`}
                          title={readiness.message}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={draft.platforms[platform]}
                              disabled={!readiness.ready && !draft.platforms[platform]}
                              onChange={(e) => {
                                if (!readiness.ready && e.target.checked) return;
                                setDraft((prev) => ({ ...prev, platforms: { ...prev.platforms, [platform]: e.target.checked } }));
                              }}
                            />
                            <span className="font-medium">{PLATFORM_LABELS[platform]}</span>
                          </span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">{readiness.ready ? 'Ready' : readiness.message}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded border border-border/60 bg-muted/40 p-3 text-sm dark:bg-white/5">
                  {selectedReadinessIssues.length === 0 ? (
                    <span className="font-medium">Selected platforms are ready.</span>
                  ) : (
                    <span className="font-medium text-amber-700 dark:text-amber-200">{selectedReadinessIssues.map((item) => item.message).join(' ')}</span>
                  )}
                </div>
              </div>
            ) : dialogStep === 2 ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Templates</p>
                      <p className="text-xs text-muted-foreground">Pick a reusable structure, then polish the final copy.</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setDialogStep(3)}>
                      Skip Templates
                    </Button>
                  </div>
                </div>
                <TemplatePicker
                  templates={SOCIAL_POST_TEMPLATES}
                  categories={templateCategories}
                  selectedTemplateId={selectedTemplateId}
                  activeCategory={templateCategory}
                  search={templateSearch}
                  onCategoryChange={(category) => setTemplateCategory(category as TemplateCategory | 'all')}
                  onSearchChange={setTemplateSearch}
                  onUseTemplate={(template) => applyTemplate(template)}
                />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Content</p>
                      <p className="text-xs text-muted-foreground">{contentCharacterCount} characters | {selectedPlatformHint}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setDialogStep(2)}>
                      Browse Templates
                    </Button>
                  </div>
                </div>
                <Textarea className="min-h-[220px] md:col-span-2" value={draft.content} onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))} placeholder="Post content" />
                <Input value={draft.ctaUrl} onChange={(e) => setDraft((prev) => ({ ...prev, ctaUrl: e.target.value }))} placeholder="CTA URL (optional)" />
                <Input value={draft.hashtagsCsv} onChange={(e) => setDraft((prev) => ({ ...prev, hashtagsCsv: e.target.value }))} placeholder="Hashtags comma-separated" />
                <Input className="md:col-span-2" value={draft.mediaCsv} onChange={(e) => setDraft((prev) => ({ ...prev, mediaCsv: e.target.value }))} placeholder="Media URLs comma-separated" />
              </div>
            )}
            <div className="mt-5 flex justify-between">
              <div>{dialogStep !== 1 && <Button variant="outline" onClick={() => setDialogStep(dialogStep === 3 ? 2 : 1)}>Back</Button>}</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setComposerOpen(false)}>Cancel</Button>
                {dialogStep === 1 ? (
                  <Button onClick={() => { if (validateStepOne()) setDialogStep(2); }}>Next</Button>
                ) : dialogStep === 2 ? (
                  <Button onClick={() => setDialogStep(3)}>Continue</Button>
                ) : (
                  <Button onClick={() => void savePost()} disabled={saving}>{saving ? 'Saving...' : dialogMode === 'edit' ? 'Save Changes' : 'Save Schedule'}</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
