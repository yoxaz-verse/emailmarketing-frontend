'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type Agent = {
  id: string;
  name: string;
  provider: string;
  status?: string;
  role_key?: string | null;
  default_model?: string | null;
  endpoint?: string | null;
  updated_at?: string | null;
};

type AgentTask = {
  id: string;
  role_key: string;
  task_type: string;
  input: string;
  status: string;
  result: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string | null;
  picked_at?: string | null;
  completed_at?: string | null;
};

type DerivedState = 'busy' | 'idle' | 'stale';

const STALE_AFTER_MS = 5 * 60 * 1000;

export default function AgentDetailClient({ agentId }: { agentId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [creatingTask, setCreatingTask] = useState(false);

  const [taskType, setTaskType] = useState('content_creation');
  const [taskInput, setTaskInput] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const agentData = await clientFetch<Agent>(`/agents/${agentId}`);
      setAgent(agentData);

      const roleKey = agentData.role_key || '';
      if (!roleKey) {
        setTasks([]);
      } else {
        const query = new URLSearchParams({ role_key: roleKey, limit: '30' });
        const taskData = await clientFetch<{ ok: boolean; tasks: AgentTask[] }>(`/api/agent/tasks?${query.toString()}`);
        setTasks(taskData.tasks ?? []);
      }

      if (!taskInput && agentData.role_key) {
        setTaskInput(`Create a ${agentData.role_key} output for OBAOL with clear action items.`);
      }
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to load agent details'));
    } finally {
      setLoading(false);
    }
  }, [agentId, taskInput]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestTask = tasks[0] ?? null;
  const derivedState = useMemo(() => deriveAgentState(latestTask), [latestTask]);

  const createTaskForAgent = useCallback(async () => {
    if (!agent?.role_key) {
      setError('This agent has no role_key. Set role_key before creating role-bound tasks.');
      return;
    }

    setCreatingTask(true);
    setError(null);
    try {
      await clientFetch<{ ok: boolean; task: { id: string } }>('/api/agent/tasks', {
        method: 'POST',
        body: JSON.stringify({
          role_key: agent.role_key,
          task_type: taskType,
          input: taskInput,
          metadata: {
            source: 'agent_detail',
            agent_id: agent.id,
          },
          source_entity: 'agent_detail',
          source_entity_id: agent.id,
        }),
      });

      await load();
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to create task'));
    } finally {
      setCreatingTask(false);
    }
  }, [agent, load, taskInput, taskType]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agent Detail</h2>
          <p className="text-sm text-muted-foreground">
            Track current activity, recent outputs, and create new role-specific tasks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Link href="/dashboard/agent-integrations">
            <Button variant="outline">Open Task Center</Button>
          </Link>
          <Link href="/dashboard/agents">
            <Button>Back to Running Agents</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Agent Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!agent ? (
            <p className="text-muted-foreground">Loading agent...</p>
          ) : (
            <>
              <div>name: <span className="font-medium">{agent.name}</span></div>
              <div>role_key: <span className="font-mono">{agent.role_key || 'not set'}</span></div>
              <div>provider: <span className="font-mono">{agent.provider}</span></div>
              <div className="flex items-center gap-2">
                <span>state:</span>
                <StateBadge state={derivedState} />
                <Badge variant="outline">{agent.status || 'active'}</Badge>
              </div>
              {derivedState === 'stale' ? (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300">
                  This agent appears stale on a processing task. Check worker logs and backend
                  <span className="font-mono"> /agents/tasks/:id/result </span>
                  submit path.
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Task For This Agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
          >
            {[
              'content_creation',
              'scraping',
              'image_prompt',
              'email_sequence',
              'lead_enrichment',
              'blog_draft',
              'social_post',
              'warehouse_content',
              'research',
              'newsletter_draft',
              'marketplace_listing',
            ].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Textarea
            className="min-h-[120px]"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Describe what this agent should do"
          />
          <Button onClick={() => void createTaskForAgent()} disabled={creatingTask || !agent?.role_key}>
            {creatingTask ? 'Creating...' : 'Create Task'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.map((task) => {
            const stale = deriveAgentState(task) === 'stale';
            return (
              <div key={task.id} className="rounded border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{task.task_type}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{task.status}</Badge>
                    {stale ? <Badge variant="destructive">stale</Badge> : null}
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(task.created_at).toLocaleString()}</div>
                <div className="mt-2 text-muted-foreground">{task.input}</div>
                {task.result ? <pre className="mt-2 max-h-44 overflow-auto rounded bg-black/20 p-2 text-xs">{task.result}</pre> : null}
                {task.error ? (
                  <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 p-2 text-red-400">
                    {task.error}
                  </div>
                ) : null}
              </div>
            );
          })}
          {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks yet for this agent role.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function deriveAgentState(task: AgentTask | null): DerivedState {
  if (!task) return 'idle';
  if (task.status !== 'processing') return 'idle';
  const pivot = task.picked_at || task.updated_at || task.created_at;
  const ts = Date.parse(pivot || '');
  if (Number.isNaN(ts)) return 'busy';
  return Date.now() - ts > STALE_AFTER_MS ? 'stale' : 'busy';
}

function StateBadge({ state }: { state: DerivedState }) {
  if (state === 'stale') return <Badge variant="destructive">stale</Badge>;
  if (state === 'busy') return <Badge className="bg-amber-500/20 text-amber-300">busy</Badge>;
  return <Badge className="bg-emerald-500/20 text-emerald-300">idle</Badge>;
}

const messageFromUnknown = (err: unknown, fallback: string) => {
  if (!(err instanceof Error)) return fallback;
  const raw = err.message?.trim();
  if (!raw) return fallback;
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
      if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
    } catch {
      return fallback;
    }
  }
  return raw;
};
