'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type AgentTask = {
  id: string;
  role_key: string;
  task_type: string;
  input: string;
  status: string;
  metadata: Record<string, unknown>;
  result: string | null;
  structured_outputs: unknown[];
  error: string | null;
  created_at: string;
  updated_at?: string | null;
  picked_at?: string | null;
  completed_at: string | null;
};

const ROLE_OPTIONS = [
  'content_creator',
  'scraper',
  'image_prompt_creator',
  'email_sequence_creator',
  'lead_enrichment_agent',
  'blog_writer',
  'social_post_creator',
  'warehouse_content_creator',
  'research_agent',
];

const TASK_TYPE_OPTIONS = [
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
];

const STALE_AFTER_MS = 5 * 60 * 1000;

export default function AgentIntegrationsClient() {
  const [error, setError] = useState<string | null>(null);

  const [taskRole, setTaskRole] = useState('content_creator');
  const [taskType, setTaskType] = useState('content_creation');
  const [taskInput, setTaskInput] = useState(
    'Create a LinkedIn post for OBAOL about warehouse booking in agro trade execution.'
  );
  const [taskMetadataText, setTaskMetadataText] = useState(
    '{\n  "module": "warehouse_management",\n  "platforms": ["linkedin", "whatsapp"],\n  "expected_outputs": ["linkedin_post", "whatsapp_post", "image_prompt"]\n}'
  );

  const [creatingTask, setCreatingTask] = useState(false);
  const [createdTask, setCreatedTask] = useState<AgentTask | null>(null);
  const [refreshingTask, setRefreshingTask] = useState(false);

  const [taskHistory, setTaskHistory] = useState<AgentTask[]>([]);
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyRole, setHistoryRole] = useState('');
  const [historyTaskType, setHistoryTaskType] = useState('');
  const [highlightedTaskId, setHighlightedTaskId] = useState<string>('');

  const creatorRef = useRef<HTMLDivElement | null>(null);

  const apiAgentFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      return clientFetch<T>(path, {
        ...options,
        cache: 'no-store',
      });
    },
    []
  );

  const loadTaskHistory = useCallback(async () => {
    const query = new URLSearchParams();
    if (historyStatus) query.set('status', historyStatus);
    if (historyRole) query.set('role_key', historyRole);
    if (historyTaskType) query.set('task_type', historyTaskType);
    query.set('limit', '20');

    try {
      const data = await apiAgentFetch<{ ok: boolean; tasks: AgentTask[] }>(
        `/api/agent/tasks?${query.toString()}`
      );
      setTaskHistory(data.tasks ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to load task history'));
    }
  }, [apiAgentFetch, historyRole, historyStatus, historyTaskType]);

  const refreshSelectedTask = useCallback(async () => {
    if (!createdTask?.id) return;
    setRefreshingTask(true);
    try {
      const data = await apiAgentFetch<{ ok: boolean; task: AgentTask }>(
        `/api/agent/tasks/${createdTask.id}`
      );
      setCreatedTask(data.task);
      await loadTaskHistory();
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to refresh task status'));
    } finally {
      setRefreshingTask(false);
    }
  }, [apiAgentFetch, createdTask?.id, loadTaskHistory]);

  useEffect(() => {
    void loadTaskHistory();
  }, [loadTaskHistory]);

  useEffect(() => {
    if (!createdTask?.id) return;
    if (
      createdTask.status === 'completed' ||
      createdTask.status === 'failed' ||
      createdTask.status === 'cancelled'
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshSelectedTask();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [createdTask?.id, createdTask?.status, refreshSelectedTask]);

  const createTask = async () => {
    setCreatingTask(true);
    setError(null);
    try {
      const metadata = JSON.parse(taskMetadataText || '{}');
      const data = await apiAgentFetch<{ ok: boolean; task: { id: string; status: string } }>(
        '/api/agent/tasks',
        {
          method: 'POST',
          body: JSON.stringify({
            role_key: taskRole,
            task_type: taskType,
            input: taskInput,
            metadata,
            source_entity: 'manual',
            source_entity_id: null,
          }),
        }
      );

      const full = await apiAgentFetch<{ ok: boolean; task: AgentTask }>(
        `/api/agent/tasks/${data.task.id}`
      );
      setCreatedTask(full.task);
      setHighlightedTaskId(full.task.id);
      await loadTaskHistory();
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to create task'));
    } finally {
      setCreatingTask(false);
    }
  };

  const selectedTaskIsStale = useMemo(() => {
    if (!createdTask || createdTask.status !== 'processing') return false;
    const pivot = createdTask.picked_at || createdTask.updated_at || createdTask.created_at;
    const ts = Date.parse(pivot || '');
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts > STALE_AFTER_MS;
  }, [createdTask]);

  const isTaskStale = useCallback((task: AgentTask) => {
    if (task.status !== 'processing') return false;
    const pivot = task.picked_at || task.updated_at || task.created_at;
    const ts = Date.parse(pivot || '');
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts > STALE_AFTER_MS;
  }, []);

  const focusTaskInHistory = useCallback(() => {
    if (!createdTask?.id) return;
    setHighlightedTaskId(createdTask.id);
    const el = document.getElementById(`task-row-${createdTask.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [createdTask?.id]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Agent Task Execution</h2>
        <p className="text-sm text-muted-foreground">
          Create Task - Worker picks it - Status updates when worker submits result.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <Card ref={creatorRef}>
        <CardHeader>
          <CardTitle>Agent Task Creator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
              value={taskRole}
              onChange={(e) => setTaskRole(e.target.value)}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
            >
              {TASK_TYPE_OPTIONS.map((task) => (
                <option key={task} value={task}>
                  {task}
                </option>
              ))}
            </select>
          </div>
          <Textarea className="min-h-[120px]" value={taskInput} onChange={(e) => setTaskInput(e.target.value)} />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Metadata JSON</label>
            <Textarea
              className="min-h-[120px]"
              value={taskMetadataText}
              onChange={(e) => setTaskMetadataText(e.target.value)}
            />
          </div>
          <Button onClick={() => void createTask()} disabled={creatingTask}>
            {creatingTask ? 'Creating...' : 'Create Task'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Task Status</CardTitle>
        </CardHeader>
        <CardContent>
          {!createdTask ? (
            <p className="text-sm text-muted-foreground">Create a task to view live status and result.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>Task ID: <span className="font-mono">{createdTask.id}</span></div>
              <div className="flex items-center gap-2">
                <span>Status:</span>
                <Badge variant="outline">{createdTask.status}</Badge>
                {selectedTaskIsStale ? <Badge variant="destructive">stale</Badge> : null}
              </div>

              {selectedTaskIsStale ? (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300">
                  This task is still processing after 5+ minutes. If stale, check worker logs and backend
                  <span className="font-mono"> /agents/tasks/:id/result </span>
                  submit path.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void refreshSelectedTask()} disabled={refreshingTask}>
                  {refreshingTask ? 'Refreshing...' : 'Refresh Status'}
                </Button>
                <Button variant="outline" onClick={focusTaskInHistory}>Open in History</Button>
                <Button
                  variant="outline"
                  onClick={() => creatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  Create New Task
                </Button>
              </div>

              {createdTask.result ? (
                <pre className="max-h-56 overflow-auto rounded bg-black/20 p-2 text-xs">{createdTask.result}</pre>
              ) : null}
              {createdTask.error ? (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-red-400">{createdTask.error}</div>
              ) : null}
              {Array.isArray(createdTask.structured_outputs) && createdTask.structured_outputs.length > 0 ? (
                <div className="space-y-2">
                  <div className="font-medium">Structured Outputs</div>
                  {(createdTask.structured_outputs as Array<Record<string, unknown>>).map((item, idx) => (
                    <div key={idx} className="rounded border border-border p-2">
                      <div className="text-xs text-muted-foreground">type: {String(item.type ?? 'unknown')}</div>
                      <pre className="mt-1 overflow-auto text-xs">{JSON.stringify(item, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No structured outputs yet.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {['', 'pending', 'processing', 'completed', 'failed'].map((status) => (
              <Button
                key={status || 'all'}
                size="sm"
                variant={historyStatus === status ? 'default' : 'outline'}
                onClick={() => setHistoryStatus(status)}
              >
                {status || 'all'}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => void loadTaskHistory()}>Refresh</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
              value={historyRole}
              onChange={(e) => setHistoryRole(e.target.value)}
            >
              <option value="">all roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
              value={historyTaskType}
              onChange={(e) => setHistoryTaskType(e.target.value)}
            >
              <option value="">all task types</option>
              {TASK_TYPE_OPTIONS.map((task) => (
                <option key={task} value={task}>{task}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {taskHistory.map((task) => {
              const stale = isTaskStale(task);
              const active = highlightedTaskId === task.id;
              return (
                <button
                  key={task.id}
                  id={`task-row-${task.id}`}
                  className={`w-full rounded border p-3 text-left ${active ? 'border-blue-500/50 bg-blue-500/5' : 'border-border'}`}
                  onClick={() => {
                    setCreatedTask(task);
                    setHighlightedTaskId(task.id);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{task.role_key} • {task.task_type}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{task.status}</Badge>
                      {stale ? <Badge variant="destructive">stale</Badge> : null}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(task.created_at).toLocaleString()}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{task.input.slice(0, 140)}</div>
                </button>
              );
            })}
            {taskHistory.length === 0 ? <p className="text-sm text-muted-foreground">No tasks found.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const messageFromUnknown = (err: unknown, fallback: string) =>
  formatErrorMessage(err, fallback);

function formatErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;

  if (err.message === 'UNAUTHORIZED') {
    return 'Session expired. Redirecting to login...';
  }

  const raw = err.message?.trim();
  if (!raw) return fallback;

  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
      if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error;
      if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message;
      return fallback;
    } catch {
      return fallback;
    }
  }

  return raw;
}
