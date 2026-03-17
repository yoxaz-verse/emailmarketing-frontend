'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  useEdgesState,
  useNodesState,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { clientFetch } from '@/lib/client-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const NODE_TYPES = ['Email', 'Wait', 'Condition', 'AI Agent'] as const;

type Sequence = {
  id: string;
  name: string;
  status?: string;
  graph_json?: { nodes: Node[]; edges: Edge[] };
};

type Agent = {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  headers_config?: Record<string, string>;
};

type ValidationError = {
  nodeId?: string;
  message: string;
};

type Props = {
  sequenceId: string;
};

const defaultNodeData: Record<string, any> = {
  Email: {
    subject: '',
    body: '',
    from: '',
    reply_to: '',
  },
  Wait: {
    delay_amount: 1,
    delay_unit: 'hours',
  },
  Condition: {
    rules: [],
    branches: { true: '', false: '' },
  },
  'AI Agent': {
    agent_id: '',
    prompt_template: '',
    input_mapping: {},
  },
};

const NodeCard = ({ data }: { data: { label: string } }) => (
  <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
    <div className="font-semibold">{data.label}</div>
  </div>
);

export default function SequenceBuilderClient({ sequenceId }: Props) {
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [status, setStatus] = useState('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [agentForm, setAgentForm] = useState({
    name: '',
    provider: 'openflow',
    endpoint: '',
    headers: '{}',
  });
  const [testContactEmail, setTestContactEmail] = useState('');
  const [testContactAttrs, setTestContactAttrs] = useState('{}');
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const saveTimer = useRef<number | null>(null);

  const selectedNode = useMemo(
    () => nodes.find(node => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const loadData = useCallback(async () => {
    try {
      const [sequenceData, agentData] = await Promise.all([
        clientFetch<Sequence>(`/sequences/${sequenceId}`),
        clientFetch<Agent[]>('/agents'),
      ]);

      const graph =
        typeof sequenceData.graph_json === 'string'
          ? JSON.parse(sequenceData.graph_json)
          : sequenceData.graph_json;

      setSequence(sequenceData);
      setStatus(sequenceData.status ?? 'draft');
      setNodes(graph?.nodes ?? []);
      setEdges(graph?.edges ?? []);
      setAgents(agentData);
    } catch (err) {
      console.error('Failed to load sequence data:', err);
      // Fallback or show error state if needed
      setAgents([]);
    }
  }, [sequenceId, setNodes, setEdges]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const persistSequence = useCallback(async () => {
    if (!sequence) return;
    setIsSaving(true);
    const updated = await clientFetch<Sequence>(`/sequences/${sequence.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: sequence.name,
        graph_json: { nodes, edges },
        status: 'draft',
      }),
    });
    setStatus(updated.status ?? 'draft');
    setIsSaving(false);
  }, [sequence, nodes, edges]);

  useEffect(() => {
    if (!sequence) return;
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      void persistSequence();
    }, 800);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [nodes, edges, sequence?.name, sequence, persistSequence]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges(eds => addEdge(connection, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance.current || !reactFlowWrapper.current) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const clientPosition = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };

    const position = reactFlowInstance.current.project
      ? reactFlowInstance.current.project(clientPosition)
      : reactFlowInstance.current.screenToFlowPosition(clientPosition);

    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position,
      data: {
        label: type,
        nodeType: type,
        ...(defaultNodeData[type] ?? {}),
      },
    };

    setNodes(nds => nds.concat(newNode));
    setSelectedNodeId(id);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const updateSelectedNodeData = (updates: Record<string, any>) => {
    if (!selectedNode) return;
    setNodes(nds =>
      nds.map(node =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
  };

  const getJsonDraft = (nodeId: string, key: string, fallback: string) => {
    const draftKey = `${nodeId}:${key}`;
    return jsonDrafts[draftKey] ?? fallback;
  };

  const setJsonDraft = (nodeId: string, key: string, value: string) => {
    const draftKey = `${nodeId}:${key}`;
    setJsonDrafts(prev => ({ ...prev, [draftKey]: value }));
  };

  const handleValidate = async () => {
    const result = await clientFetch<{ valid: boolean; errors: ValidationError[] }>(
      `/sequences/${sequenceId}/validate`,
      { method: 'POST' }
    );
    setValidationErrors(result.errors);
    setStatus(result.valid ? 'valid' : 'invalid');
  };

  const handleCreateAgent = async () => {
    let headersConfig = {};
    try {
      headersConfig = JSON.parse(agentForm.headers || '{}');
      setJsonErrors(prev => ({ ...prev, agentHeaders: '' }));
    } catch {
      setJsonErrors(prev => ({ ...prev, agentHeaders: 'Invalid JSON.' }));
      return;
    }

    await clientFetch('/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: agentForm.name,
        provider: agentForm.provider,
        endpoint: agentForm.endpoint,
        headers_config: headersConfig,
      }),
    });

    setAgentForm({ name: '', provider: 'openflow', endpoint: '', headers: '{}' });
    const updated = await clientFetch<Agent[]>('/agents');
    setAgents(updated);
  };

  const handleExecuteTest = async () => {
    if (!testContactEmail) return;
    let attributes = {};
    try {
      attributes = JSON.parse(testContactAttrs || '{}');
      setJsonErrors(prev => ({ ...prev, testContact: '' }));
    } catch {
      setJsonErrors(prev => ({ ...prev, testContact: 'Invalid JSON.' }));
      return;
    }

    await clientFetch(`/sequences/${sequenceId}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        contacts: [{ email: testContactEmail, ...attributes }],
      }),
    });
  };

  const renderNodeConfig = () => {
    if (!selectedNode) {
      return <p className="text-sm text-muted-foreground">Select a node to configure it.</p>;
    }

    const nodeType = selectedNode.type || selectedNode.data?.nodeType;
    const data = selectedNode.data ?? {};

    if (nodeType === 'Email') {
      return (
        <div className="space-y-3">
          <Input
            placeholder="Subject"
            value={data.subject || ''}
            onChange={e => updateSelectedNodeData({ subject: e.target.value })}
          />
          <Textarea
            placeholder="Email body"
            value={data.body || ''}
            onChange={e => updateSelectedNodeData({ body: e.target.value })}
          />
          <Input
            placeholder="From"
            value={data.from || ''}
            onChange={e => updateSelectedNodeData({ from: e.target.value })}
          />
          <Input
            placeholder="Reply-to"
            value={data.reply_to || ''}
            onChange={e => updateSelectedNodeData({ reply_to: e.target.value })}
          />
        </div>
      );
    }

    if (nodeType === 'Wait') {
      return (
        <div className="space-y-3">
          <Input
            type="number"
            placeholder="Delay amount"
            value={data.delay_amount ?? 1}
            onChange={e =>
              updateSelectedNodeData({ delay_amount: Number(e.target.value) })
            }
          />
          <select
            className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
            value={data.delay_unit ?? 'hours'}
            onChange={e => updateSelectedNodeData({ delay_unit: e.target.value })}
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      );
    }

    if (nodeType === 'Condition') {
      const rulesFallback = JSON.stringify(data.rules ?? [], null, 2);
      return (
        <div className="space-y-3">
          <Textarea
            placeholder="Rules JSON"
            value={getJsonDraft(selectedNode.id, 'rules', rulesFallback)}
            onChange={e => {
              const nextValue = e.target.value;
              setJsonDraft(selectedNode.id, 'rules', nextValue);
              try {
                const parsed = JSON.parse(nextValue || '[]');
                setJsonErrors(prev => ({ ...prev, rules: '' }));
                updateSelectedNodeData({ rules: parsed });
              } catch {
                setJsonErrors(prev => ({ ...prev, rules: 'Invalid JSON.' }));
              }
            }}
          />
          {jsonErrors.rules && (
            <p className="text-xs text-red-500">{jsonErrors.rules}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <select
              className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
              value={data.branches?.true ?? ''}
              onChange={e =>
                updateSelectedNodeData({
                  branches: { ...data.branches, true: e.target.value },
                })
              }
            >
              <option value="">True branch</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.data?.label ?? node.id}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
              value={data.branches?.false ?? ''}
              onChange={e =>
                updateSelectedNodeData({
                  branches: { ...data.branches, false: e.target.value },
                })
              }
            >
              <option value="">False branch</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.data?.label ?? node.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    if (nodeType === 'AI Agent') {
      return (
        <div className="space-y-3">
          <select
            className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
            value={data.agent_id ?? ''}
            onChange={e => updateSelectedNodeData({ agent_id: e.target.value })}
          >
            <option value="">Select agent</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <Textarea
            placeholder="Prompt template"
            value={data.prompt_template ?? ''}
            onChange={e =>
              updateSelectedNodeData({ prompt_template: e.target.value })
            }
          />
          <Textarea
            placeholder="Input mapping JSON"
            value={getJsonDraft(
              selectedNode.id,
              'mapping',
              JSON.stringify(data.input_mapping ?? {}, null, 2)
            )}
            onChange={e => {
              const nextValue = e.target.value;
              setJsonDraft(selectedNode.id, 'mapping', nextValue);
              try {
                const parsed = JSON.parse(nextValue || '{}');
                setJsonErrors(prev => ({ ...prev, mapping: '' }));
                updateSelectedNodeData({ input_mapping: parsed });
              } catch {
                setJsonErrors(prev => ({ ...prev, mapping: 'Invalid JSON.' }));
              }
            }}
          />
          {jsonErrors.mapping && (
            <p className="text-xs text-red-500">{jsonErrors.mapping}</p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="grid h-[calc(100vh-120px)] grid-cols-[220px_minmax(0,1fr)_320px] gap-4 p-6">
      <aside className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold">Node Palette</h2>
          <p className="text-xs text-muted-foreground">
            Drag nodes onto the canvas.
          </p>
        </div>
        <div className="space-y-2">
          {NODE_TYPES.map(type => (
            <div
              key={type}
              draggable
              onDragStart={event => onDragStart(event, type)}
              className="cursor-grab rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              {type}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <Input
              value={sequence?.name ?? ''}
              placeholder="Sequence name"
              onChange={e =>
                setSequence(prev =>
                  prev ? { ...prev, name: e.target.value } : prev
                )
              }
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge>{status}</Badge>
            {isSaving && <span className="text-xs text-muted-foreground">Saving…</span>}
            <Button variant="outline" onClick={handleValidate}>
              Validate
            </Button>
          </div>
        </div>
        <div
          className="flex-1"
          ref={reactFlowWrapper}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={{
              Email: NodeCard,
              Wait: NodeCard,
              Condition: NodeCard,
              'AI Agent': NodeCard,
            }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={instance => {
              reactFlowInstance.current = instance;
              instance.fitView();
            }}
            fitView
          >
            <Background gap={16} />
            <MiniMap />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      <aside className="space-y-4 rounded-lg border border-border bg-card p-4 overflow-y-auto">
        <div>
          <h2 className="text-sm font-semibold">Node Configuration</h2>
          {renderNodeConfig()}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Validation Errors</h3>
          {validationErrors.length === 0 && (
            <p className="text-xs text-muted-foreground">No errors yet.</p>
          )}
          {validationErrors.map((err, idx) => (
            <div key={`${err.nodeId ?? 'global'}-${idx}`} className="text-xs">
              <span className="font-medium">{err.nodeId ?? 'Sequence'}:</span>{' '}
              {err.message}
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Assigned Agents</h3>
          <div className="space-y-2">
            {agents.map(agent => (
              <div key={agent.id} className="rounded-md border border-border px-3 py-2 text-xs">
                <div className="font-medium">{agent.name}</div>
                <div className="text-muted-foreground">{agent.provider}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Input
              placeholder="Agent name"
              value={agentForm.name}
              onChange={e => setAgentForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <Input
              placeholder="Provider"
              value={agentForm.provider}
              onChange={e =>
                setAgentForm(prev => ({ ...prev, provider: e.target.value }))
              }
            />
            <Input
              placeholder="Webhook endpoint"
              value={agentForm.endpoint}
              onChange={e =>
                setAgentForm(prev => ({ ...prev, endpoint: e.target.value }))
              }
            />
            <Textarea
              placeholder="Headers JSON"
              value={agentForm.headers}
              onChange={e =>
                setAgentForm(prev => ({ ...prev, headers: e.target.value }))
              }
            />
            {jsonErrors.agentHeaders && (
              <p className="text-xs text-red-500">{jsonErrors.agentHeaders}</p>
            )}
            <Button onClick={handleCreateAgent}>Create Agent</Button>
          </div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Execute Test</h3>
          <Input
            placeholder="Test contact email"
            value={testContactEmail}
            onChange={e => setTestContactEmail(e.target.value)}
          />
          <Textarea
            placeholder="Contact attributes JSON"
            value={testContactAttrs}
            onChange={e => setTestContactAttrs(e.target.value)}
          />
          {jsonErrors.testContact && (
            <p className="text-xs text-red-500">{jsonErrors.testContact}</p>
          )}
          <Button variant="outline" onClick={handleExecuteTest}>
            Execute
          </Button>
        </div>
      </aside>
    </div>
  );
}
