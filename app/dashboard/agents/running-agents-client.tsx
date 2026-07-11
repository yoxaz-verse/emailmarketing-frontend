'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clientFetch } from '@/lib/client-fetch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Mission = {
  id: string;
  agent_id: string;
  name: string;
  role_key: string;
  task_type: string;
  mission_goal: string;
  instructions: string;
  cadence_type: 'daily' | 'weekly';
  cadence_value: number;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  active: boolean;
  execution_policy: 'scheduled' | 'always_on' | 'manual_approval';
  output_policy: 'task_center_only' | 'approval_required';
  priority: number;
  last_status: string | null;
};

type RuntimeAgent = {
  id: string;
  name: string;
  provider: string;
  role_key: string | null;
  status?: string;
  missions: Mission[];
  mission_count: number;
  active_mission_count: number;
  next_run_at: string | null;
  latest_task: {
    id: string;
    status: string;
    approval_status?: 'not_required' | 'pending' | 'approved' | 'rejected';
    task_type: string;
    created_at: string;
    picked_at?: string | null;
    updated_at?: string | null;
  } | null;
  pending_approval_count?: number;
};

type MissionTemplate = {
  name: string;
  role_key: string;
  task_type: string;
  mission_goal: string;
  instructions: string;
  cadence_type: 'daily' | 'weekly';
  cadence_value: number;
  timezone: string;
  priority: number;
};

type DerivedState = 'active' | 'busy' | 'idle' | 'stale' | 'paused' | 'error' | 'review';

const STALE_AFTER_MS = 5 * 60 * 1000;

const DEFAULT_TEMPLATE_BY_ROLE: Record<string, number> = {
  research_agent: 0,
  content_creator: 1,
  social_post_creator: 2,
  lead_enrichment_agent: 3,
  email_sequence_creator: 4,
  blog_writer: 5,
};

export default function RunningAgentsClient() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [agents, setAgents] = useState<RuntimeAgent[]>([]);
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [runtime, templateData] = await Promise.all([
        clientFetch<{ ok: boolean; agents: RuntimeAgent[] }>('/api/agent/runtime'),
        clientFetch<{ ok: boolean; templates: MissionTemplate[] }>('/api/agent/mission-templates'),
      ]);
      setAgents(runtime.agents ?? []);
      setTemplates(templateData.templates ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to load runtime agents'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    return agents.map((agent) => ({
      ...agent,
      derivedState: deriveAgentState(agent),
    }));
  }, [agents]);
  const parsedError = useMemo(() => parseUiError(error), [error]);

  const createMissionFromTemplate = useCallback(async (agent: RuntimeAgent) => {
    const role = String(agent.role_key ?? '').trim();
    const templateIndex = DEFAULT_TEMPLATE_BY_ROLE[role];
    const template = Number.isFinite(templateIndex) ? templates[templateIndex] : templates[0];
    if (!template) throw new Error('No mission templates available');

    await clientFetch('/api/agent/missions', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: agent.id,
        name: template.name,
        role_key: template.role_key,
        task_type: template.task_type,
        mission_goal: template.mission_goal,
        instructions: template.instructions,
        cadence_type: template.cadence_type,
        cadence_value: template.cadence_value,
        timezone: template.timezone,
        execution_policy: 'scheduled',
        output_policy: 'approval_required',
        priority: template.priority,
        next_run_at: new Date(Date.now() + 60 * 1000).toISOString(),
        active: true,
      }),
    });
  }, [templates]);

  const pauseMission = useCallback(async (id: string) => {
    await clientFetch(`/api/agent/missions/${id}/pause`, { method: 'POST', body: JSON.stringify({}) });
  }, []);

  const resumeMission = useCallback(async (id: string) => {
    await clientFetch(`/api/agent/missions/${id}/resume`, {
      method: 'POST',
      body: JSON.stringify({ next_run_at: new Date(Date.now() + 60 * 1000).toISOString() }),
    });
  }, []);

  const runMissionNow = useCallback(async (id: string) => {
    await clientFetch(`/api/agent/missions/${id}/run-now`, { method: 'POST', body: JSON.stringify({}) });
  }, []);

  const withAction = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, 'Action failed'));
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const bootstrapEmployeeTeam = useCallback(async () => {
    setError(null);
    setNotice(null);
    setBusyId('bootstrap-team');
    try {
      const out = await clientFetch<{
        ok: boolean;
        agents_created: number;
        agents_reused: number;
        missions_created: number;
        missions_reused: number;
      }>('/api/agent/bootstrap-employee-team', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setNotice(
        `Employee team ready: agents +${out.agents_created} (reused ${out.agents_reused}), missions +${out.missions_created} (reused ${out.missions_reused}).`
      );
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, 'Bootstrap failed'));
    } finally {
      setBusyId(null);
    }
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Running Agents</h2>
          <p className="text-sm text-muted-foreground">
            Persistent employee-agents with recurring missions, runtime state, and task dispatch controls.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Link href="/dashboard/agent-integrations">
            <Button>Open Task Center</Button>
          </Link>
        </div>
      </div>

      {parsedError ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
          <p>{parsedError.message}</p>
          {parsedError.details ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-rose-700 dark:text-rose-300">Technical details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-red-700 dark:text-red-200">
                {parsedError.details}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
      {notice ? <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Agent Runtime Control Center</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((agent) => (
            <div key={agent.id} className="rounded border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">
                    role: {agent.role_key || 'not set'} • provider: {agent.provider}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{agent.status || 'active'}</Badge>
                  <StateBadge state={agent.derivedState} />
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                missions: {agent.active_mission_count}/{agent.mission_count} active • next run:{' '}
                {agent.next_run_at ? new Date(agent.next_run_at).toLocaleString() : 'not scheduled'}
                {' '}• pending approvals: {agent.pending_approval_count ?? 0}
              </div>

              {agent.latest_task ? (
                <div className="text-xs text-muted-foreground">
                  latest task: {agent.latest_task.task_type} • {agent.latest_task.status} •{' '}
                  {agent.latest_task.approval_status ? `${agent.latest_task.approval_status} • ` : ''}
                  {new Date(agent.latest_task.created_at).toLocaleString()}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No task history yet for this role.</div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busyId)}
                  onClick={() => void withAction(agent.id, () => createMissionFromTemplate(agent))}
                >
                  Create Mission From Template
                </Button>
                <Link href={`/dashboard/agents/${agent.id}`}>
                  <Button size="sm" variant="outline">Open Agent Detail</Button>
                </Link>
              </div>

              {agent.missions.length > 0 ? (
                <div className="space-y-2">
                  {agent.missions.slice(0, 4).map((mission) => (
                    <div key={mission.id} className="rounded border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{mission.name}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{mission.execution_policy}</Badge>
                          <Badge variant="outline">{mission.output_policy}</Badge>
                          <Badge className={mission.active ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-muted text-muted-foreground dark:bg-zinc-500/20 dark:text-zinc-300'}>
                            {mission.active ? 'active' : 'paused'}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {mission.cadence_type} every {mission.cadence_value} • next:{' '}
                        {mission.next_run_at ? new Date(mission.next_run_at).toLocaleString() : 'not set'}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === mission.id}
                          onClick={() => void withAction(mission.id, () => runMissionNow(mission.id))}
                        >
                          Run Now
                        </Button>
                        {mission.active ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === mission.id}
                            onClick={() => void withAction(mission.id, () => pauseMission(mission.id))}
                          >
                            Pause
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === mission.id}
                            onClick={() => void withAction(mission.id, () => resumeMission(mission.id))}
                          >
                            Resume
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No missions configured yet. Create one from templates.</p>
              )}
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="rounded border border-dashed border-border/60 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                No agents found yet. Create your employee-team in one click, then missions will run automatically on schedule.
              </p>
              <Button
                onClick={() => void bootstrapEmployeeTeam()}
                disabled={busyId === 'bootstrap-team'}
              >
                {busyId === 'bootstrap-team' ? 'Creating Employee Team...' : 'Create Employee Team'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function deriveAgentState(agent: RuntimeAgent): DerivedState {
  const activeMissions = agent.missions.filter((m) => m.active);
  if (activeMissions.length === 0) return 'paused';
  if ((agent.latest_task?.status || '') === 'failed') return 'error';
  if ((agent.pending_approval_count ?? 0) > 0) return 'review';
  if ((agent.latest_task?.status || '') === 'processing') {
    const pivot = agent.latest_task?.picked_at || agent.latest_task?.updated_at || agent.latest_task?.created_at;
    const ts = Date.parse(String(pivot || ''));
    if (!Number.isNaN(ts) && Date.now() - ts > STALE_AFTER_MS) return 'stale';
    return 'busy';
  }
  if (agent.next_run_at) return 'active';
  return 'idle';
}

function StateBadge({ state }: { state: DerivedState }) {
  if (state === 'stale') return <Badge variant="destructive">stale</Badge>;
  if (state === 'busy') return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/20 dark:text-amber-300">busy</Badge>;
  if (state === 'review') return <Badge className="bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">approval pending</Badge>;
  if (state === 'paused') return <Badge className="bg-muted text-muted-foreground dark:bg-zinc-500/20 dark:text-zinc-300">paused</Badge>;
  if (state === 'error') return <Badge className="bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">error</Badge>;
  if (state === 'active') return <Badge className="bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">active</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">idle</Badge>;
}

const messageFromUnknown = (err: unknown, fallback: string) => {
  if (!(err instanceof Error)) return fallback;
  const raw = err.message?.trim();
  if (!raw) return fallback;
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as {
        error?: unknown;
        message?: unknown;
        upstreamBodyPreview?: unknown;
      };
      const preview =
        typeof parsed.upstreamBodyPreview === 'string'
          ? parsed.upstreamBodyPreview.trim()
          : '';
      const looksLikeHtmlError =
        preview.startsWith('<!DOCTYPE html') ||
        preview.startsWith('<html') ||
        preview.includes('Cannot POST /agents/bootstrap-employee-team');

      if (looksLikeHtmlError) {
        return [
          'Backend route unavailable on target API base; check NEXT_PUBLIC_API_BASE_URL and backend version.',
          preview ? `Technical details: ${preview}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      }

      if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
      if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
    } catch {
      return fallback;
    }
  }
  return raw;
};

function parseUiError(error: string | null): { message: string; details: string | null } | null {
  if (!error) return null;
  const marker = 'Technical details:';
  const idx = error.indexOf(marker);
  if (idx === -1) {
    return { message: error, details: null };
  }
  return {
    message: error.slice(0, idx).trim(),
    details: error.slice(idx + marker.length).trim() || null,
  };
}
