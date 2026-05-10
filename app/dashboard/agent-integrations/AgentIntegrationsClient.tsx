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
};

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

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
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

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

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
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const saveAgent = async () => {
    setSaving(true);
    setFormError(null);
    try {
      let headersConfig = {};
      try {
        headersConfig = JSON.parse(form.headers_config || '{}');
      } catch {
        setFormError('Headers JSON is invalid.');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agent Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Manage OpenClaw/OpenClo and custom agent API connections from one place.
          </p>
        </div>
        <Button onClick={openCreateModal}>New Integration</Button>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

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
                    <div className="text-xs text-muted-foreground">{agent.provider} • {agent.base_url || agent.endpoint || 'No URL set'}</div>
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
            <CardTitle>Test Connection</CardTitle>
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
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs text-muted-foreground">Headers JSON</label>
              <Textarea className="min-h-[120px]" value={form.headers_config} onChange={(e) => setForm((s) => ({ ...s, headers_config: e.target.value }))} />
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
    err instanceof Error ? err.message : fallback;
