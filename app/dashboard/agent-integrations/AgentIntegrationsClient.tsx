'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type Agent = {
  id: string;
  name: string;
  provider: string;
  provider_type: 'preset' | 'custom';
  base_url: string | null;
  endpoint: string | null;
  auth_type: 'none' | 'api_key' | 'bearer' | 'custom_header';
  auth_header_name: string | null;
  headers_config: Record<string, string>;
  default_model: string | null;
  default_path: string | null;
  role_key: string | null;
  memory_policy: {
    strategy: 'window' | 'summary';
    max_turns?: number;
    summary_trigger_tokens?: number;
  } | null;
  status: string;
  last_test_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
  last_test_latency_ms: number | null;
  updated_at: string;
  created_at: string;
  has_secret: boolean;
};

type AgentTestResult = {
  success: boolean;
  statusCode: number;
  latencyMs: number;
  responsePreview: unknown;
  error?: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type QueueIntegration = {
  id: string;
  name: string;
  provider: string;
  mode: string;
  status: string;
  model: string | null;
  role_key: string | null;
  config: Record<string, unknown>;
  created_at: string;
};

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
  completed_at: string | null;
};

type FormState = {
  name: string;
  provider: string;
  provider_type: 'preset' | 'custom';
  base_url: string;
  endpoint: string;
  auth_type: 'none' | 'api_key' | 'bearer' | 'custom_header';
  auth_header_name: string;
  auth_secret: string;
  headers_config: string;
  default_model: string;
  default_path: string;
  role_key: string;
  memory_policy: string;
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

const initialForm: FormState = {
  name: '',
  provider: 'openclaw',
  provider_type: 'preset',
  base_url: '',
  endpoint: '',
  auth_type: 'bearer',
  auth_header_name: 'Authorization',
  auth_secret: '',
  headers_config: '{}',
  default_model: 'gpt-4.1-mini',
  default_path: '/v1/responses',
  role_key: '',
  memory_policy: '{\n  "strategy": "summary",\n  "max_turns": 12,\n  "summary_trigger_tokens": 8000\n}',
};

const initialQueueIntegration = {
  name: 'OpenClaw Local Worker',
  provider: 'openclaw',
  mode: 'task_queue',
  status: 'active',
  model: 'openai-codex/gpt-5.4',
  role_key: 'content_creator',
  config: '{\n  "worker": "local_mac",\n  "gateway": "private",\n  "notes": "OpenClaw runs locally and processes queued tasks through worker"\n}',
};

export default function AgentIntegrationsClient() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [testPayloadText, setTestPayloadText] = useState('{\n  "input": "ping"\n}');
  const [testPath, setTestPath] = useState('');
  const [testModel, setTestModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AgentTestResult | null>(null);
  const [memoryUserId, setMemoryUserId] = useState('');
  const [memoryView, setMemoryView] = useState<JsonValue | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const [integrations, setIntegrations] = useState<QueueIntegration[]>([]);
  const [integrationForm, setIntegrationForm] = useState(initialQueueIntegration);
  const [savingIntegration, setSavingIntegration] = useState(false);

  const [taskRole, setTaskRole] = useState('content_creator');
  const [taskType, setTaskType] = useState('content_creation');
  const [taskInput, setTaskInput] = useState('Create a LinkedIn post for OBAOL about warehouse booking in agro trade execution.');
  const [taskMetadataText, setTaskMetadataText] = useState('{\n  "module": "warehouse_management",\n  "platforms": ["linkedin", "whatsapp"],\n  "expected_outputs": ["linkedin_post", "whatsapp_post", "image_prompt"]\n}');
  const [creatingTask, setCreatingTask] = useState(false);
  const [createdTask, setCreatedTask] = useState<AgentTask | null>(null);
  const [taskHistory, setTaskHistory] = useState<AgentTask[]>([]);
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyRole, setHistoryRole] = useState('');
  const [historyTaskType, setHistoryTaskType] = useState('');

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  const apiAgentFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      return clientFetch<T>(path, {
        ...options,
        cache: 'no-store',
      });
    },
    []
  );

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clientFetch<Agent[]>('/agents');
      setAgents(data);
      if (data.length > 0 && !selectedAgentId) setSelectedAgentId(data[0].id);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, 'Failed to load agents'));
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  const loadQueueIntegrations = useCallback(async () => {
    try {
      const data = await apiAgentFetch<{ ok: boolean; integrations: QueueIntegration[] }>('/api/agent/integrations');
      setIntegrations(data.integrations ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to load queue integrations'));
    }
  }, [apiAgentFetch]);

  const loadTaskHistory = useCallback(async () => {
    const query = new URLSearchParams();
    if (historyStatus) query.set('status', historyStatus);
    if (historyRole) query.set('role_key', historyRole);
    if (historyTaskType) query.set('task_type', historyTaskType);
    query.set('limit', '20');

    try {
      const data = await apiAgentFetch<{ ok: boolean; tasks: AgentTask[] }>(`/api/agent/tasks?${query.toString()}`);
      setTaskHistory(data.tasks ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to load task history'));
    }
  }, [apiAgentFetch, historyRole, historyStatus, historyTaskType]);

  useEffect(() => {
    void loadAgents();
    void loadQueueIntegrations();
    void loadTaskHistory();
  }, [loadAgents, loadQueueIntegrations, loadTaskHistory]);

  useEffect(() => {
    if (!createdTask?.id) return;
    if (createdTask.status === 'completed' || createdTask.status === 'failed' || createdTask.status === 'cancelled') return;

    const timer = window.setInterval(async () => {
      try {
        const data = await apiAgentFetch<{ ok: boolean; task: AgentTask }>(`/api/agent/tasks/${createdTask.id}`);
        setCreatedTask(data.task);
        if (data.task.status === 'completed' || data.task.status === 'failed' || data.task.status === 'cancelled') {
          window.clearInterval(timer);
          void loadTaskHistory();
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [apiAgentFetch, createdTask?.id, createdTask?.status, loadTaskHistory]);

  const openCreateModal = () => {
    setEditingAgent(null);
    setForm(initialForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      provider: agent.provider,
      provider_type: agent.provider_type,
      base_url: agent.base_url ?? '',
      endpoint: agent.endpoint ?? '',
      auth_type: agent.auth_type,
      auth_header_name: agent.auth_header_name ?? '',
      auth_secret: '',
      headers_config: JSON.stringify(agent.headers_config ?? {}, null, 2),
      default_model: agent.default_model ?? '',
      default_path: agent.default_path ?? '',
      role_key: agent.role_key ?? '',
      memory_policy: JSON.stringify(agent.memory_policy ?? { strategy: 'summary', max_turns: 12, summary_trigger_tokens: 8000 }, null, 2),
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const saveAgent = async () => {
    setSaving(true);
    setFormError(null);
    try {
      let headersConfig = {};
      let memoryPolicy = { strategy: 'summary', max_turns: 12, summary_trigger_tokens: 8000 };
      try {
        headersConfig = JSON.parse(form.headers_config || '{}');
      } catch {
        setFormError('Headers JSON is invalid.');
        setSaving(false);
        return;
      }
      try {
        memoryPolicy = JSON.parse(form.memory_policy || '{}');
      } catch {
        setFormError('Memory policy JSON is invalid.');
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name,
        provider: form.provider,
        provider_type: form.provider_type,
        base_url: form.base_url,
        endpoint: form.endpoint,
        auth_type: form.auth_type,
        auth_header_name: form.auth_header_name,
        auth_secret: form.auth_secret || undefined,
        headers_config: headersConfig,
        default_model: form.default_model,
        default_path: form.default_path,
        role_key: form.role_key || undefined,
        memory_policy: memoryPolicy,
      };

      if (editingAgent) {
        await clientFetch(`/agents/${editingAgent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await clientFetch('/agents', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      await loadAgents();
    } catch (err: unknown) {
      setFormError(messageFromUnknown(err, 'Failed to save agent'));
    } finally {
      setSaving(false);
    }
  };

  const loadMemory = async () => {
    if (!memoryUserId || !selectedAgent?.role_key) {
      setError('Select an agent with role_key and enter user id to view memory.');
      return;
    }
    setMemoryLoading(true);
    setMemoryView(null);
    try {
      const data = await clientFetch<unknown>(
        `/agents/memory?user_id=${encodeURIComponent(memoryUserId)}&role_key=${encodeURIComponent(selectedAgent.role_key)}`
      );
      setMemoryView(data as JsonValue);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, 'Failed to load memory'));
    } finally {
      setMemoryLoading(false);
    }
  };

  const resetMemory = async () => {
    if (!memoryUserId || !selectedAgent?.role_key) {
      setError('Select an agent with role_key and enter user id to reset memory.');
      return;
    }
    if (!confirm('Reset memory for this user+role?')) return;
    setMemoryLoading(true);
    try {
      await clientFetch<unknown>(
        `/agents/memory?user_id=${encodeURIComponent(memoryUserId)}&role_key=${encodeURIComponent(selectedAgent.role_key)}`,
        { method: 'DELETE' }
      );
      setMemoryView(null);
      await loadMemory();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, 'Failed to reset memory'));
    } finally {
      setMemoryLoading(false);
    }
  };

  const removeAgent = async (id: string) => {
    if (!confirm('Delete this integration?')) return;

    try {
      await clientFetch(`/agents/${id}`, { method: 'DELETE' });
      await loadAgents();
      if (selectedAgentId === id) {
        setSelectedAgentId('');
      }
    } catch (err: unknown) {
      setError(messageFromUnknown(err, 'Delete failed'));
    }
  };

  const runTest = async () => {
    if (!selectedAgentId) return;

    setTesting(true);
    setTestResult(null);
    try {
      let payload = {};
      try {
        payload = JSON.parse(testPayloadText || '{}');
      } catch {
        setError('Test payload JSON is invalid.');
        setTesting(false);
        return;
      }

      const result = await clientFetch<AgentTestResult>(`/agents/${selectedAgentId}/test`, {
        method: 'POST',
        body: JSON.stringify({
          payload,
          path: testPath || undefined,
          model: testModel || undefined,
        }),
      });

      setTestResult(result);
      await loadAgents();
    } catch (err: unknown) {
      setTestResult({
        success: false,
        statusCode: 0,
        latencyMs: 0,
        responsePreview: null,
        error: messageFromUnknown(err, 'Connection test failed'),
      });
    } finally {
      setTesting(false);
    }
  };

  const saveQueueIntegration = async () => {
    setSavingIntegration(true);
    try {
      const config = JSON.parse(integrationForm.config || '{}');
      await apiAgentFetch('/api/agent/integrations', {
        method: 'POST',
        body: JSON.stringify({
          name: integrationForm.name,
          provider: integrationForm.provider,
          mode: integrationForm.mode,
          status: integrationForm.status,
          model: integrationForm.model,
          role_key: integrationForm.role_key,
          config,
        }),
      });
      await loadQueueIntegrations();
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to save queue integration'));
    } finally {
      setSavingIntegration(false);
    }
  };

  const createTask = async () => {
    setCreatingTask(true);
    try {
      const metadata = JSON.parse(taskMetadataText || '{}');
      const data = await apiAgentFetch<{ ok: boolean; task: { id: string; status: string } }>('/api/agent/tasks', {
        method: 'POST',
        body: JSON.stringify({
          role_key: taskRole,
          task_type: taskType,
          input: taskInput,
          metadata,
          source_entity: 'manual',
          source_entity_id: null,
        }),
      });

      const full = await apiAgentFetch<{ ok: boolean; task: AgentTask }>(`/api/agent/tasks/${data.task.id}`);
      setCreatedTask(full.task);
      await loadTaskHistory();
    } catch (err) {
      setError(messageFromUnknown(err, 'Failed to create task'));
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agent Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Manage OpenClaw integrations and queue-based AI task execution.
          </p>
        </div>
        <Button onClick={openCreateModal}>New Integration</Button>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>OpenClaw Queue Integration Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Name" value={integrationForm.name} onChange={(e) => setIntegrationForm((s) => ({ ...s, name: e.target.value }))} />
            <Input placeholder="Provider" value={integrationForm.provider} onChange={(e) => setIntegrationForm((s) => ({ ...s, provider: e.target.value }))} />
            <Input placeholder="Mode" value={integrationForm.mode} onChange={(e) => setIntegrationForm((s) => ({ ...s, mode: e.target.value }))} />
            <Input placeholder="Model" value={integrationForm.model} onChange={(e) => setIntegrationForm((s) => ({ ...s, model: e.target.value }))} />
            <Input placeholder="Default Role" value={integrationForm.role_key} onChange={(e) => setIntegrationForm((s) => ({ ...s, role_key: e.target.value }))} />
            <select className="rounded-md border border-border bg-card px-3 py-2 text-sm" value={integrationForm.status} onChange={(e) => setIntegrationForm((s) => ({ ...s, status: e.target.value }))}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Config JSON</label>
            <Textarea className="min-h-[120px]" value={integrationForm.config} onChange={(e) => setIntegrationForm((s) => ({ ...s, config: e.target.value }))} />
          </div>
          <Button onClick={() => void saveQueueIntegration()} disabled={savingIntegration}>{savingIntegration ? 'Saving...' : 'Save Queue Integration'}</Button>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Configured Queue Integrations</h4>
            {integrations.length === 0 ? <p className="text-sm text-muted-foreground">No queue integrations yet.</p> : null}
            {integrations.map((integration) => (
              <div key={integration.id} className="rounded border border-border p-3 text-sm">
                <div className="font-medium">{integration.name}</div>
                <div className="text-muted-foreground">{integration.provider} • {integration.mode} • {integration.status}</div>
                <div className="text-xs text-muted-foreground">model: {integration.model || 'n/a'} • role: {integration.role_key || 'n/a'}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Task Creator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <select className="rounded-md border border-border bg-card px-3 py-2 text-sm" value={taskRole} onChange={(e) => setTaskRole(e.target.value)}>
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <select className="rounded-md border border-border bg-card px-3 py-2 text-sm" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
              {TASK_TYPE_OPTIONS.map((task) => <option key={task} value={task}>{task}</option>)}
            </select>
          </div>
          <Textarea className="min-h-[120px]" value={taskInput} onChange={(e) => setTaskInput(e.target.value)} />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Metadata JSON</label>
            <Textarea className="min-h-[120px]" value={taskMetadataText} onChange={(e) => setTaskMetadataText(e.target.value)} />
          </div>
          <Button onClick={() => void createTask()} disabled={creatingTask}>{creatingTask ? 'Creating...' : 'Create Task'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Result Viewer</CardTitle>
        </CardHeader>
        <CardContent>
          {!createdTask ? <p className="text-sm text-muted-foreground">Create a task to view live status and result.</p> : (
            <div className="space-y-3 text-sm">
              <div>Task ID: <span className="font-mono">{createdTask.id}</span></div>
              <div>Status: <Badge variant="outline">{createdTask.status}</Badge></div>
              {createdTask.result ? <pre className="max-h-56 overflow-auto rounded bg-black/20 p-2 text-xs">{createdTask.result}</pre> : null}
              {createdTask.error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-red-400">{createdTask.error}</div> : null}
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
              ) : <div className="text-xs text-muted-foreground">No structured outputs yet.</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="status" value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} />
            <Input placeholder="role_key" value={historyRole} onChange={(e) => setHistoryRole(e.target.value)} />
            <Input placeholder="task_type" value={historyTaskType} onChange={(e) => setHistoryTaskType(e.target.value)} />
            <Button variant="outline" onClick={() => void loadTaskHistory()}>Refresh</Button>
          </div>
          <div className="space-y-2">
            {taskHistory.map((task) => (
              <button key={task.id} className="w-full rounded border border-border p-3 text-left" onClick={() => setCreatedTask(task)}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{task.role_key} • {task.task_type}</div>
                  <Badge variant="outline">{task.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(task.created_at).toLocaleString()}</div>
                <div className="mt-1 text-sm text-muted-foreground">{task.input.slice(0, 140)}</div>
              </button>
            ))}
            {taskHistory.length === 0 ? <p className="text-sm text-muted-foreground">No tasks found.</p> : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading integrations...</p>}
            {!loading && agents.length === 0 && (
              <p className="text-sm text-muted-foreground">No integrations yet. Add your first provider.</p>
            )}
            {!loading && agents.map((agent) => (
              <div
                key={agent.id}
                className={`rounded border p-3 ${selectedAgentId === agent.id ? 'border-blue-500/50 bg-blue-500/5' : 'border-border'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    className="text-left"
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.provider} • role: {agent.role_key || 'unassigned'} • {agent.base_url || agent.endpoint || 'No URL set'}</div>
                  </button>
                  <Badge variant="outline">{agent.status}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditModal(agent)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => void removeAgent(agent.id)}>Delete</Button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Updated: {new Date(agent.updated_at).toLocaleString()} • Secret: {agent.has_secret ? 'configured' : 'missing'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Connection + Memory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            >
              <option value="">Select integration</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>

            <Input placeholder="Override path (optional)" value={testPath} onChange={(e) => setTestPath(e.target.value)} />
            <Input placeholder="Override model (optional)" value={testModel} onChange={(e) => setTestModel(e.target.value)} />
            <Textarea
              className="min-h-[180px]"
              value={testPayloadText}
              onChange={(e) => setTestPayloadText(e.target.value)}
            />

            <Button onClick={() => void runTest()} disabled={!selectedAgent || testing}>
              {testing ? 'Testing...' : 'Run Test'}
            </Button>

            {testResult && (
              <div className={`rounded border p-3 text-sm ${testResult.success ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                <div>
                  Result: <strong>{testResult.success ? 'Success' : 'Failure'}</strong>
                </div>
                <div>Status Code: {testResult.statusCode}</div>
                <div>Latency: {testResult.latencyMs} ms</div>
                {testResult.error && <div>Error: {testResult.error}</div>}
                <pre className="mt-2 max-h-52 overflow-auto rounded bg-black/20 p-2 text-xs">
                  {JSON.stringify(testResult.responsePreview, null, 2)}
                </pre>
              </div>
            )}

            <div className="mt-4 rounded border border-border p-3">
              <div className="mb-2 text-sm font-medium">Memory Controls</div>
              <Input placeholder="User ID for memory" value={memoryUserId} onChange={(e) => setMemoryUserId(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <Button variant="outline" onClick={() => void loadMemory()} disabled={memoryLoading || !selectedAgent}>View Memory</Button>
                <Button variant="destructive" onClick={() => void resetMemory()} disabled={memoryLoading || !selectedAgent}>Reset Memory</Button>
              </div>
              {memoryView && (
                <pre className="mt-2 max-h-52 overflow-auto rounded bg-black/20 p-2 text-xs">
                  {JSON.stringify(memoryView, null, 2)}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingAgent ? 'Edit Integration' : 'New Integration'}</h3>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
              <Input placeholder="Provider" value={form.provider} onChange={(e) => setForm((s) => ({ ...s, provider: e.target.value }))} />

              <select className="rounded-md border border-border bg-card px-3 py-2 text-sm" value={form.provider_type} onChange={(e) => setForm((s) => ({ ...s, provider_type: e.target.value as FormState['provider_type'] }))}>
                <option value="preset">preset</option>
                <option value="custom">custom</option>
              </select>

              <select className="rounded-md border border-border bg-card px-3 py-2 text-sm" value={form.auth_type} onChange={(e) => setForm((s) => ({ ...s, auth_type: e.target.value as FormState['auth_type'] }))}>
                <option value="none">none</option>
                <option value="bearer">bearer</option>
                <option value="api_key">api_key</option>
                <option value="custom_header">custom_header</option>
              </select>

              <Input placeholder="Base URL" value={form.base_url} onChange={(e) => setForm((s) => ({ ...s, base_url: e.target.value }))} />
              <Input placeholder="Fallback Endpoint" value={form.endpoint} onChange={(e) => setForm((s) => ({ ...s, endpoint: e.target.value }))} />

              <Input placeholder="Auth Header Name" value={form.auth_header_name} onChange={(e) => setForm((s) => ({ ...s, auth_header_name: e.target.value }))} />
              <Input type="password" placeholder={editingAgent?.has_secret ? 'Leave blank to keep existing secret' : 'API Secret'} value={form.auth_secret} onChange={(e) => setForm((s) => ({ ...s, auth_secret: e.target.value }))} />

              <Input placeholder="Default Model" value={form.default_model} onChange={(e) => setForm((s) => ({ ...s, default_model: e.target.value }))} />
              <Input placeholder="Default Path" value={form.default_path} onChange={(e) => setForm((s) => ({ ...s, default_path: e.target.value }))} />
              <Input placeholder="Role Key (content_creator, etc.)" value={form.role_key} onChange={(e) => setForm((s) => ({ ...s, role_key: e.target.value }))} />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs text-muted-foreground">Headers JSON</label>
              <Textarea className="min-h-[120px]" value={form.headers_config} onChange={(e) => setForm((s) => ({ ...s, headers_config: e.target.value }))} />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-muted-foreground">Memory Policy JSON</label>
              <Textarea className="min-h-[120px]" value={form.memory_policy} onChange={(e) => setForm((s) => ({ ...s, memory_policy: e.target.value }))} />
            </div>

            {formError && <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">{formError}</div>}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={() => void saveAgent()} disabled={saving}>{saving ? 'Saving...' : 'Save Integration'}</Button>
            </div>
          </div>
        </div>
      )}
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
