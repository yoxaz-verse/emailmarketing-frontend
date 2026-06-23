'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clientFetch } from '@/lib/client-fetch';

type PlatformCode = 'meta' | 'linkedin' | 'reddit' | 'telegram' | 'whatsapp';
type CalendarView = 'month' | 'week';
type DialogMode = 'create' | 'edit';
type DialogStep = 1 | 2;

type ScheduledSocialPost = {
  id: string;
  content: string;
  platforms: PlatformCode[];
  ctaUrl?: string;
  hashtags: string[];
  media: string[];
  scheduledAtUtc: string;
  timezone: 'Asia/Kolkata';
  status: 'queued' | 'manual_action_required';
  createdAt: string;
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
  telegram: 'bg-sky-500/15 text-sky-700 border-sky-500/30 dark:bg-sky-600/20 dark:text-sky-300 dark:border-sky-500/30',
  whatsapp: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30 dark:bg-green-600/20 dark:text-green-300 dark:border-green-500/30',
};

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), diff);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeInput(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function composeLocalDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const local = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(local.getTime())) return null;
  return local;
}

function isStrictlyFutureDateTime(dateStr: string, timeStr: string): boolean {
  const scheduled = composeLocalDateTime(dateStr, timeStr);
  if (!scheduled) return false;
  return scheduled.getTime() > Date.now();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isDayFullyElapsed(date: Date): boolean {
  return endOfDay(date).getTime() <= Date.now();
}

function isPastOrCurrentSlot(date: Date): boolean {
  return date.getTime() <= Date.now();
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date);
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const start = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(weekStart);
  const end = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(weekEnd);
  return `${start} - ${end}`;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
}

function defaultDraftForDate(date: Date): ComposerDraft {
  return {
    scheduledDate: toDateInput(date),
    scheduledTime: toTimeInput(date),
    platforms: { meta: true, linkedin: true, reddit: false, telegram: true, whatsapp: true },
    content: 'New update from Obaol. We just published a practical growth playbook for Indian SMBs. Read now.',
    ctaUrl: '',
    hashtagsCsv: '#Marketing,#India,#Growth',
    mediaCsv: '',
  };
}

function createDraftFromPost(post: ScheduledSocialPost): ComposerDraft {
  const dt = new Date(post.scheduledAtUtc);
  const selected: Record<PlatformCode, boolean> = {
    meta: false,
    linkedin: false,
    reddit: false,
    telegram: false,
    whatsapp: false,
  };
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

function seedPosts(now: Date): ScheduledSocialPost[] {
  const day1 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
  const day2 = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 30, 0), 1);
  const day3 = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 15, 0), 3);

  return [
    {
      id: 'seed-1',
      content: 'Weekly funnel tips for founders in India.',
      platforms: ['meta', 'linkedin'],
      ctaUrl: 'https://obaol.com/blog/funnel-tips',
      hashtags: ['#Marketing', '#Founders'],
      media: [],
      scheduledAtUtc: day1.toISOString(),
      timezone: 'Asia/Kolkata',
      status: 'manual_action_required',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'seed-2',
      content: 'Case study drop: how one campaign improved replies.',
      platforms: ['linkedin', 'telegram'],
      hashtags: ['#B2B', '#Growth'],
      media: [],
      scheduledAtUtc: day2.toISOString(),
      timezone: 'Asia/Kolkata',
      status: 'queued',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'seed-3',
      content: 'AMA thread invite for campaign ops Q&A.',
      platforms: ['reddit', 'whatsapp'],
      hashtags: ['#Community'],
      media: [],
      scheduledAtUtc: day3.toISOString(),
      timezone: 'Asia/Kolkata',
      status: 'queued',
      createdAt: new Date().toISOString(),
    },
  ];
}

function getSelectedPlatforms(platforms: Record<PlatformCode, boolean>): PlatformCode[] {
  return (Object.keys(platforms) as PlatformCode[]).filter((p) => platforms[p]);
}

function buildQuarterHourOptions(): string[] {
  const values: string[] = [];
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 15) {
      values.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return values;
}

function addMinutes(date: Date, minutes: number): Date {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function nextMondayAt10(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const delta = ((8 - day) % 7) || 7;
  next.setDate(next.getDate() + delta);
  next.setHours(10, 0, 0, 0);
  return next;
}

export default function SocialSchedulingClient() {
  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [posts, setPosts] = useState<ScheduledSocialPost[]>(() => seedPosts(new Date()));
  const [composerOpen, setComposerOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [dialogStep, setDialogStep] = useState<DialogStep>(1);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ComposerDraft>(defaultDraftForDate(new Date()));
  const [error, setError] = useState<string | null>(null);

  const quarterHourOptions = useMemo(() => buildQuarterHourOptions(), []);
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 21 }, (_, i) => currentYear - 10 + i),
    [currentYear]
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(anchorDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(anchorDate.getFullYear());
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const weekStart = startOfWeek(anchorDate);

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

  const upcoming = useMemo(() => {
    return [...posts]
      .sort((a, b) => new Date(a.scheduledAtUtc).getTime() - new Date(b.scheduledAtUtc).getTime())
      .slice(0, 5);
  }, [posts]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledSocialPost[]>();
    for (const post of posts) {
      const d = new Date(post.scheduledAtUtc);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    }
    return map;
  }, [posts]);

  const schedulePreview = useMemo(() => {
    const local = composeLocalDateTime(draft.scheduledDate, draft.scheduledTime);
    if (!local) return 'Select date and time';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(local);
  }, [draft.scheduledDate, draft.scheduledTime]);

  const selectedPlatforms = useMemo(() => getSelectedPlatforms(draft.platforms), [draft.platforms]);
  const disabledTimeOptions = useMemo(() => {
    const map = new Set<string>();
    for (const opt of quarterHourOptions) {
      if (!isStrictlyFutureDateTime(draft.scheduledDate, opt)) {
        map.add(opt);
      }
    }
    return map;
  }, [draft.scheduledDate, quarterHourOptions]);

  const openComposerForDate = (date: Date) => {
    const prefill = new Date(date);
    if (prefill.getHours() === 0 && prefill.getMinutes() === 0) prefill.setHours(10, 0, 0, 0);
    setDialogMode('create');
    setDialogStep(1);
    setActivePostId(null);
    setDraft(defaultDraftForDate(prefill));
    setComposerOpen(true);
    setError(null);
  };

  const openComposerForEdit = (post: ScheduledSocialPost) => {
    setDialogMode('edit');
    setDialogStep(1);
    setActivePostId(post.id);
    setDraft(createDraftFromPost(post));
    setComposerOpen(true);
    setError(null);
  };

  const applyPreset = (preset: 'now' | 'plus30' | 'plus60' | 'tomorrow10' | 'nextMonday10') => {
    const base = composeLocalDateTime(draft.scheduledDate, draft.scheduledTime) ?? new Date();
    let next = new Date(base);

    if (preset === 'now') {
      next = new Date();
      const mins = next.getMinutes();
      next.setMinutes(Math.ceil(mins / 15) * 15, 0, 0);
    } else if (preset === 'plus30') {
      next = addMinutes(base, 30);
    } else if (preset === 'plus60') {
      next = addMinutes(base, 60);
    } else if (preset === 'tomorrow10') {
      next = addDays(base, 1);
      next.setHours(10, 0, 0, 0);
    } else if (preset === 'nextMonday10') {
      next = nextMondayAt10(base);
    }

    setDraft((prev) => ({ ...prev, scheduledDate: toDateInput(next), scheduledTime: toTimeInput(next) }));
  };

  const changeAnchor = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      const now = new Date();
      setAnchorDate(now);
      setSelectedMonth(now.getMonth());
      setSelectedYear(now.getFullYear());
      return;
    }

    const d = new Date(anchorDate);
    if (view === 'month') d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
    else d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
    setAnchorDate(d);
    setSelectedMonth(d.getMonth());
    setSelectedYear(d.getFullYear());
  };

  const jumpToMonthYear = (month: number, year: number) => {
    const day = view === 'week' ? 1 : Math.min(anchorDate.getDate(), new Date(year, month + 1, 0).getDate());
    const next = new Date(year, month, day, anchorDate.getHours(), anchorDate.getMinutes(), 0, 0);
    setAnchorDate(next);
  };

  const validateStepOne = (): boolean => {
    const local = composeLocalDateTime(draft.scheduledDate, draft.scheduledTime);
    if (!local) {
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
    setError(null);
    return true;
  };

  const savePost = async () => {
    setError(null);

    const local = composeLocalDateTime(draft.scheduledDate, draft.scheduledTime);
    if (!local) {
      setError('Please choose a valid schedule date and time.');
      return;
    }
    if (!isStrictlyFutureDateTime(draft.scheduledDate, draft.scheduledTime)) {
      setError('scheduled_at must be in the future');
      return;
    }
    const platforms = getSelectedPlatforms(draft.platforms);
    if (platforms.length === 0) {
      setError('Select at least one platform.');
      return;
    }
    if (!draft.content.trim()) {
      setError('Post content is required.');
      return;
    }

    const payload: ScheduledSocialPost = {
      id: activePostId ?? `local-${Date.now()}`,
      content: draft.content.trim(),
      platforms,
      ctaUrl: draft.ctaUrl.trim() || undefined,
      hashtags: draft.hashtagsCsv.split(',').map((s) => s.trim()).filter(Boolean),
      media: draft.mediaCsv.split(',').map((s) => s.trim()).filter(Boolean),
      scheduledAtUtc: local.toISOString(),
      timezone: 'Asia/Kolkata',
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    if (dialogMode === 'edit' && activePostId) {
      setPosts((prev) => prev.map((p) => (p.id === activePostId ? { ...p, ...payload, id: activePostId } : p)));
    } else {
      setPosts((prev) => [...prev, payload]);
    }

    try {
      await clientFetch('/social/publish-jobs', {
        method: 'POST',
        body: JSON.stringify({
          targets: platforms,
          post_input: {
            content: payload.content,
            media: payload.media,
            cta_url: payload.ctaUrl,
            hashtags: payload.hashtags,
            timezone: payload.timezone,
            scheduled_at: payload.scheduledAtUtc,
          },
        }),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create publish jobs');
      return;
    }

    setComposerOpen(false);
    setActivePostId(null);
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
        className="w-full cursor-pointer rounded border border-border/60 bg-muted/40 dark:bg-white/5 px-2 py-1 text-left text-xs hover:border-blue-400/60"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{formatTime(date)}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {post.status === 'queued' ? 'Queued' : 'Manual'}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{post.content}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {post.platforms.slice(0, 2).map((platform) => (
            <span key={`${post.id}-${platform}`} className={`rounded border px-1.5 py-0.5 text-[10px] ${PLATFORM_COLORS[platform]}`}>
              {PLATFORM_LABELS[platform]}
            </span>
          ))}
          {post.platforms.length > 2 && (
            <span className="rounded border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">+{post.platforms.length - 2}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Social Scheduling Calendar</h2>
        <p className="text-sm text-muted-foreground">Plan posts visually with month/week calendar views in IST.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <CardTitle>Calendar</CardTitle>
            <div className="sticky top-2 z-10 rounded-xl border border-border/60 bg-background/80 p-3 backdrop-blur">
              <div className="flex flex-wrap items-center gap-3 md:gap-4">
                <div className="rounded-lg border border-border/60 p-2">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">View</p>
                  <div className="inline-flex rounded-md border border-border/60 p-1">
                    <Button size="sm" variant={view === 'month' ? 'default' : 'ghost'} onClick={() => setView('month')}>Month</Button>
                    <Button size="sm" variant={view === 'week' ? 'default' : 'ghost'} onClick={() => setView('week')}>Week</Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 p-2 md:min-w-[170px]">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Period</p>
                  <p className="text-sm font-medium">
                    {view === 'month' ? formatMonthLabel(anchorDate) : formatWeekLabel(weekStart)}
                  </p>
                </div>

                <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.03] p-2 md:border-l-2 md:border-l-blue-400/70">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 dark:text-blue-200">Navigate</p>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 dark:bg-white/[0.02] p-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      title="Previous period"
                      aria-label="Previous period"
                      className="h-9 min-w-10 border-border/70 bg-muted/40 dark:bg-white/5 px-3 transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => changeAnchor('prev')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      title="Go to today"
                      aria-label="Go to today"
                      className="h-9 rounded-md bg-blue-600 px-4 font-semibold text-white shadow-[0_0_0_1px_rgba(59,130,246,0.5),0_8px_24px_rgba(59,130,246,0.25)] transition hover:-translate-y-0.5 hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300"
                      onClick={() => changeAnchor('today')}
                    >
                      Today
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Next period"
                      aria-label="Next period"
                      className="h-9 min-w-10 border-border/70 bg-muted/40 dark:bg-white/5 px-3 transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => changeAnchor('next')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 p-2">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Jump to month/year</p>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={selectedMonth}
                      onChange={(e) => {
                        const month = Number(e.target.value);
                        setSelectedMonth(month);
                        jumpToMonthYear(month, selectedYear);
                      }}
                      title="Jump to month"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i}>
                          {new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(2026, i, 1))}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={selectedYear}
                      onChange={(e) => {
                        const year = Number(e.target.value);
                        setSelectedYear(year);
                        jumpToMonthYear(selectedMonth, year);
                      }}
                      title="Jump to year"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ml-auto rounded-lg border border-border/60 p-2">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Action</p>
                  <Button
                    size="sm"
                    onClick={() => openComposerForDate(new Date())}
                  >
                    + Schedule Post
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{IST_TIMEZONE}</p>
        </CardHeader>
        <CardContent>
          {view === 'month' && (
            <div className="grid grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="px-2 py-1 text-xs font-semibold text-muted-foreground">{d}</div>
              ))}

              {monthGridDays.map((day) => {
                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                const dayPosts = postsByDay.get(key) ?? [];
                const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
                const isTodayCell = isSameDay(day, today);
                const isPastDayCell = isDayFullyElapsed(day);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (isPastDayCell) return;
                      openComposerForDate(day);
                    }}
                    aria-disabled={isPastDayCell}
                    className={`min-h-[130px] rounded-lg border p-2 text-left transition ${
                      isPastDayCell ? '' : 'hover:border-blue-400/60'
                    } ${
                      isCurrentMonth ? 'border-border/60 bg-muted/40 dark:bg-white/5' : 'border-border/40 bg-muted/30 dark:bg-white/[0.02]'
                    } ${isTodayCell && !isPastDayCell ? 'ring-1 ring-blue-500/70' : ''} ${
                      isPastDayCell
                        ? 'cursor-not-allowed border-red-400/70 bg-rose-500/15 text-rose-700 dark:bg-red-500/20 dark:text-red-100'
                        : ''
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-sm font-semibold ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>{day.getDate()}</span>
                      {isTodayCell ? (
                        <Badge className="bg-blue-600 text-white">Today</Badge>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      {dayPosts.slice(0, 2).map(renderPostChip)}
                      {dayPosts.length > 2 && (
                        <p className="text-[11px] text-muted-foreground">+{dayPosts.length - 2} more</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {view === 'week' && (
            <div className="space-y-2">
              <div className="grid grid-cols-8 gap-2">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Time</div>
                {weekDays.map((d) => (
                  <div key={d.toISOString()} className={`rounded px-2 py-1 text-xs font-semibold ${isSameDay(d, today) ? 'bg-blue-600/20 text-blue-700 dark:text-blue-300 dark:text-blue-200' : 'text-muted-foreground'}`}>
                    {new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)}
                  </div>
                ))}
              </div>

              {Array.from({ length: 24 }, (_, hour) => {
                const hourLabel = `${String(hour).padStart(2, '0')}:00`;
                return (
                  <div key={hourLabel} className="grid grid-cols-8 gap-2">
                    <div className="px-2 py-2 text-xs text-muted-foreground">{hourLabel}</div>
                    {weekDays.map((d) => {
                      const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0);
                      const key = `${slot.getFullYear()}-${slot.getMonth()}-${slot.getDate()}`;
                      const dayPosts = (postsByDay.get(key) ?? []).filter((p) => {
                        const time = new Date(p.scheduledAtUtc);
                        return time.getHours() === hour;
                      });
                      const nowLine = isSameDay(d, today) && today.getHours() === hour;
                      const slotDisabled = isPastOrCurrentSlot(slot);

                      return (
                        <button
                          key={slot.toISOString()}
                          type="button"
                          onClick={() => {
                            if (slotDisabled) return;
                            openComposerForDate(slot);
                          }}
                          aria-disabled={slotDisabled}
                          className={`min-h-[64px] rounded border p-1 text-left ${
                            slotDisabled ? '' : 'hover:border-blue-400/60'
                          } ${nowLine ? 'border-blue-500/60 bg-blue-500/10' : 'border-border/60 bg-muted/40 dark:bg-white/5'} ${
                            slotDisabled
                              ? 'cursor-not-allowed border-red-400/70 bg-rose-500/15 text-rose-700 dark:bg-red-500/20 dark:text-red-100'
                              : ''
                          }`}
                        >
                          {dayPosts.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground">+ schedule</span>
                          ) : (
                            <div className="space-y-1">
                              {dayPosts.slice(0, 1).map(renderPostChip)}
                              {dayPosts.length > 1 && <p className="text-[10px] text-muted-foreground">+{dayPosts.length - 1} more</p>}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
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
          {upcoming.map((post) => {
            const at = new Date(post.scheduledAtUtc);
            return (
              <div key={post.id} className="rounded border border-border/60 bg-muted/40 dark:bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(at)}</p>
                  <Badge variant="secondary">{post.status === 'queued' ? 'Queued' : 'Manual Assisted'}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {post.platforms.map((platform) => (
                    <span key={`${post.id}-${platform}`} className={`rounded border px-1.5 py-0.5 text-[10px] ${PLATFORM_COLORS[platform]}`}>
                      {PLATFORM_LABELS[platform]}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-border/60 bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{dialogMode === 'edit' ? 'Edit Scheduled Post' : 'Create Scheduled Post'}</h3>
                <p className="text-xs text-muted-foreground mt-1">{schedulePreview} • {selectedPlatforms.map((p) => PLATFORM_LABELS[p]).join(', ') || 'No platforms selected'} • {IST_TIMEZONE}</p>
              </div>
              <Button variant="ghost" onClick={() => setComposerOpen(false)}>Close</Button>
            </div>

            <div className="mb-4 inline-flex rounded-md border border-border/60 p-1">
              <Button size="sm" variant={dialogStep === 1 ? 'default' : 'ghost'} onClick={() => setDialogStep(1)}>1. Schedule</Button>
              <Button size="sm" variant={dialogStep === 2 ? 'default' : 'ghost'} onClick={() => setDialogStep(2)}>2. Content</Button>
            </div>

            {error && <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

            {dialogStep === 1 && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Date</p>
                    <Input
                      type="date"
                      value={draft.scheduledDate}
                      min={toDateInput(new Date())}
                      onChange={(e) => setDraft((prev) => ({ ...prev, scheduledDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Time (15-min slots)</p>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={draft.scheduledTime}
                      onChange={(e) => setDraft((prev) => ({ ...prev, scheduledTime: e.target.value }))}
                    >
                      {quarterHourOptions.map((opt) => (
                        <option key={opt} value={opt} disabled={disabledTimeOptions.has(opt)}>
                          {disabledTimeOptions.has(opt) ? `${opt} (past)` : opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Quick presets</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => applyPreset('now')}>Now</Button>
                    <Button size="sm" variant="outline" onClick={() => applyPreset('plus30')}>+30m</Button>
                    <Button size="sm" variant="outline" onClick={() => applyPreset('plus60')}>+1h</Button>
                    <Button size="sm" variant="outline" onClick={() => applyPreset('tomorrow10')}>Tomorrow 10:00</Button>
                    <Button size="sm" variant="outline" onClick={() => applyPreset('nextMonday10')}>Next Monday 10:00</Button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Platforms</p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {(Object.keys(PLATFORM_LABELS) as PlatformCode[]).map((platform) => (
                      <label key={platform} className="flex items-center gap-2 rounded border border-border/60 p-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.platforms[platform]}
                          onChange={(e) => setDraft((prev) => ({
                            ...prev,
                            platforms: { ...prev.platforms, [platform]: e.target.checked },
                          }))}
                        />
                        {PLATFORM_LABELS[platform]}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded border border-border/60 bg-muted/40 dark:bg-white/5 p-3 text-sm">
                  <span className="text-muted-foreground">Status preview:</span> <span className="font-medium">Queued (manual-assisted publish flow)</span>
                </div>
              </div>
            )}

            {dialogStep === 2 && (
              <div className="grid gap-3 md:grid-cols-2">
                <Textarea
                  className="md:col-span-2"
                  value={draft.content}
                  onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Post content"
                />
                <Input
                  value={draft.ctaUrl}
                  onChange={(e) => setDraft((prev) => ({ ...prev, ctaUrl: e.target.value }))}
                  placeholder="CTA URL (optional)"
                />
                <Input
                  value={draft.hashtagsCsv}
                  onChange={(e) => setDraft((prev) => ({ ...prev, hashtagsCsv: e.target.value }))}
                  placeholder="Hashtags comma-separated"
                />
                <Input
                  className="md:col-span-2"
                  value={draft.mediaCsv}
                  onChange={(e) => setDraft((prev) => ({ ...prev, mediaCsv: e.target.value }))}
                  placeholder="Media URLs comma-separated"
                />
              </div>
            )}

            <div className="mt-5 flex justify-between">
              <div>
                {dialogStep === 2 && (
                  <Button variant="outline" onClick={() => setDialogStep(1)}>Back</Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setComposerOpen(false)}>Cancel</Button>
                {dialogStep === 1 ? (
                  <Button onClick={() => {
                    if (validateStepOne()) setDialogStep(2);
                  }}>Next</Button>
                ) : (
                  <Button onClick={() => void savePost()}>{dialogMode === 'edit' ? 'Save Changes' : 'Save Schedule'}</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
