'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { clientFetch } from '@/lib/client-fetch';
import { Bot, Cable, CheckCircle2, CircleAlert, RefreshCw, Settings2, Zap } from 'lucide-react';

type SocialConnectionStatus = 'connected' | 'expired' | 'missing_scope' | 'identity_required' | 'disconnected';
type Operator = { id: string; name: string; region?: string | null };
type OperatorLoadErrorKind = 'backend_unavailable' | 'unauthorized' | 'unknown';
type Platform = 'linkedin' | 'meta' | 'reddit' | 'telegram' | 'whatsapp';
type NextAction = 'select_operator' | 'configure_credentials' | 'connect_account' | 'select_account' | 'enable_automation' | 'ready';

type MetaPage = {
  id: string;
  name: string;
  instagram_business_account?: { id?: string; username?: string; name?: string } | null;
};

type PlatformSetup = {
  platform_code: Platform;
  label: string;
  credential_configured: boolean;
  credential_missing_fields: string[];
  credential_fields: Record<string, string>;
  connection_status: SocialConnectionStatus;
  connection_reason: string | null;
  connected: boolean;
  can_schedule: boolean;
  can_publish: boolean;
  setup_ready: boolean;
  next_action: NextAction;
  account_selection?: {
    pages: MetaPage[];
    selected_page_id: string;
    selected_page_name: string;
    selected_instagram_account_id: string;
    selected_instagram_username: string;
    discovery_error?: string | null;
  } | null;
};

type SetupStatus = {
  operator_id: string | null;
  ready: boolean;
  next_action: NextAction;
  automation: { enabled: boolean; agent_id: string | null; mission_id: string | null };
  platforms: PlatformSetup[];
};

const PLATFORMS: { code: Platform; label: string; connectLabel: string }[] = [
  { code: 'linkedin', label: 'LinkedIn', connectLabel: 'Connect LinkedIn' },
  { code: 'meta', label: 'Meta / Instagram', connectLabel: 'Connect Meta' },
  { code: 'reddit', label: 'Reddit', connectLabel: 'Connect Reddit' },
  { code: 'telegram', label: 'Telegram', connectLabel: 'Validate Telegram' },
  { code: 'whatsapp', label: 'WhatsApp', connectLabel: 'Validate WhatsApp' },
];

const PLATFORM_FIELDS: Record<Platform, { key: string; label: string; secret?: boolean; placeholder?: string }[]> = {
  linkedin: [
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://your-backend.com/social/oauth2-credential/callback' },
    { key: 'scopes', label: 'Scopes', placeholder: 'w_member_social' },
    { key: 'actor_urn', label: 'LinkedIn Member URN', placeholder: 'Optional advanced fallback' },
  ],
  meta: [
    { key: 'app_id', label: 'App ID' },
    { key: 'app_secret', label: 'App Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://your-backend.com/social/callback/meta' },
    { key: 'page_access_token', label: 'Page Access Token', secret: true },
    { key: 'business_account_id', label: 'Business Account ID' },
  ],
  reddit: [
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://your-backend.com/social/callback/reddit' },
    { key: 'user_agent', label: 'User Agent', placeholder: 'obaol-social-connector/1.0 by u_username' },
  ],
  telegram: [
    { key: 'bot_token', label: 'Bot Token', secret: true },
    { key: 'chat_id', label: 'Chat ID' },
  ],
  whatsapp: [
    { key: 'phone_number_id', label: 'Phone Number ID' },
    { key: 'business_account_id', label: 'Business Account ID' },
    { key: 'access_token', label: 'Access Token', secret: true },
  ],
};

const ACTION_LABELS: Record<NextAction, string> = {
  select_operator: 'Select operator',
  configure_credentials: 'Save operator credentials',
  connect_account: 'Connect account',
  select_account: 'Save account selection',
  enable_automation: 'Enable social automation',
  ready: 'Social Engine ready',
};

function toTitle(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function mapSocialConnectorError(message: string): string {
  const lower = String(message || '').toLowerCase();
  if (lower.includes('backend unavailable') || lower.includes('failed to fetch') || lower.includes('timed out')) {
    return 'Backend is unavailable. Start or restart the backend service, then refresh this setup page.';
  }
  if (lower.includes('operator-owned') || lower.includes('missing required fields')) {
    return message;
  }
  if (lower.includes('permission') || lower.includes('scope')) {
    return 'The provider rejected the connection because required permissions are missing. Update the operator app credentials/scopes, then reconnect.';
  }
  return message || 'Social setup failed.';
}

function statusBadgeClass(platform: PlatformSetup): string {
  if (platform.setup_ready) return 'bg-green-600 text-white';
  if (!platform.credential_configured) return 'bg-amber-600 text-white';
  if (platform.connected) return 'bg-blue-600 text-white';
  if (platform.connection_status === 'expired' || platform.connection_status === 'missing_scope') return 'bg-orange-600 text-white';
  return 'bg-muted text-foreground dark:bg-slate-600 dark:text-white';
}

function platformStatusText(platform: PlatformSetup): string {
  if (platform.setup_ready) return 'Ready';
  if (!platform.credential_configured) return 'Credentials needed';
  if (!platform.connected) return 'Connect needed';
  if (platform.next_action === 'select_account') return 'Account selection';
  return ACTION_LABELS[platform.next_action] ?? toTitle(platform.connection_status);
}

function emptyStatus(operatorId: string | null): SetupStatus {
  return {
    operator_id: operatorId,
    ready: false,
    next_action: operatorId ? 'configure_credentials' : 'select_operator',
    automation: { enabled: false, agent_id: null, mission_id: null },
    platforms: [],
  };
}

export default function SocialConnectorsClient({
  role,
  operators = [],
  operatorLoadError,
  operatorLoadErrorKind,
}: {
  role?: string;
  operators?: Operator[];
  operatorLoadError?: string;
  operatorLoadErrorKind?: OperatorLoadErrorKind;
}) {
  const searchParams = useSearchParams();
  const callbackOperatorId = String(searchParams.get('operator_id') ?? '').trim();
  const [selectedOperatorId, setSelectedOperatorId] = useState(callbackOperatorId);
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin');
  const [status, setStatus] = useState<SetupStatus>(() => emptyStatus(callbackOperatorId || null));
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [selectedPageId, setSelectedPageId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === 'admin' || role === 'superadmin';
  const canUseOperator = !isAdmin || Boolean(selectedOperatorId);
  const activeSetup = status.platforms.find((platform) => platform.platform_code === activePlatform);
  const readyCount = status.platforms.filter((platform) => platform.setup_ready).length;
  const configuredCount = status.platforms.filter((platform) => platform.credential_configured).length;
  const connectedCount = status.platforms.filter((platform) => platform.connected).length;

  const nextPlatform = useMemo(() => {
    return status.platforms.find((platform) => platform.next_action !== 'ready') ?? status.platforms[0] ?? null;
  }, [status.platforms]);

  const loadStatus = useCallback(async () => {
    if (!canUseOperator) {
      setStatus(emptyStatus(null));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = isAdmin && selectedOperatorId ? `?operator_id=${encodeURIComponent(selectedOperatorId)}` : '';
      const data = await clientFetch<SetupStatus>(`/social/setup/status${query}`);
      setStatus(data ?? emptyStatus(selectedOperatorId || null));
    } catch (err: unknown) {
      setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to load social setup status'));
    } finally {
      setLoading(false);
    }
  }, [canUseOperator, isAdmin, selectedOperatorId]);

  useEffect(() => {
    if (isAdmin && !selectedOperatorId && operators.length === 1) {
      setSelectedOperatorId(String(operators[0]?.id ?? ''));
    }
  }, [isAdmin, operators, selectedOperatorId]);

  useEffect(() => {
    if (isAdmin && callbackOperatorId && callbackOperatorId !== selectedOperatorId) {
      setSelectedOperatorId(callbackOperatorId);
    }
  }, [callbackOperatorId, isAdmin, selectedOperatorId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const connectedPlatform = searchParams.get('social_connected');
    const connectError = searchParams.get('social_connect_error');
    if (connectedPlatform) {
      setMessage(`${toTitle(connectedPlatform)} connected. Continue the setup below.`);
      setActivePlatform(connectedPlatform as Platform);
    }
    if (connectError) {
      setError(mapSocialConnectorError(connectError));
    }
  }, [searchParams]);

  useEffect(() => {
    const fields = activeSetup?.credential_fields ?? {};
    setFormValues(fields);
    if (activeSetup?.platform_code === 'meta') {
      setSelectedPageId(activeSetup.account_selection?.selected_page_id || activeSetup.account_selection?.pages?.[0]?.id || '');
    }
  }, [activePlatform, activeSetup]);

  const operatorQuery = isAdmin && selectedOperatorId ? `?operator_id=${encodeURIComponent(selectedOperatorId)}` : '';

  async function saveCredentials(platform: Platform = activePlatform) {
    if (!canUseOperator) {
      setError('Select an operator before saving social credentials.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await clientFetch('/social/setup/credentials', {
        method: 'POST',
        body: JSON.stringify({
          operator_id: selectedOperatorId || undefined,
          platform,
          fields: formValues,
        }),
      });
      setMessage(`${PLATFORMS.find((item) => item.code === platform)?.label ?? platform} credentials saved.`);
      await loadStatus();
    } catch (err: unknown) {
      setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to save social credentials'));
    } finally {
      setSaving(false);
    }
  }

  async function startConnect(platform: Platform = activePlatform) {
    if (!canUseOperator) {
      setError('Select an operator before connecting a social platform.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await clientFetch<{ redirect_url: string }>('/social/setup/start', {
        method: 'POST',
        body: JSON.stringify({ operator_id: selectedOperatorId || undefined, platform }),
      });
      if (data?.redirect_url) window.location.href = data.redirect_url;
    } catch (err: unknown) {
      setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to start social connect'));
    } finally {
      setSaving(false);
    }
  }

  async function saveAccountSelection() {
    if (!selectedPageId) {
      setError('Select a Meta Page before saving account selection.');
      return;
    }
    const page = activeSetup?.account_selection?.pages?.find((item) => item.id === selectedPageId);
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await clientFetch('/social/setup/account-selection', {
        method: 'POST',
        body: JSON.stringify({
          operator_id: selectedOperatorId || undefined,
          selected_page_id: selectedPageId,
          selected_instagram_account_id: page?.instagram_business_account?.id || undefined,
        }),
      });
      setMessage('Meta Page and Instagram account selection saved.');
      await loadStatus();
    } catch (err: unknown) {
      setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to save account selection'));
    } finally {
      setSaving(false);
    }
  }

  async function enableAutomation() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await clientFetch('/social/setup/automation', {
        method: 'POST',
        body: JSON.stringify({ operator_id: selectedOperatorId || undefined, timezone: 'Asia/Kolkata' }),
      });
      setMessage('Social automation is enabled. Agent drafts will require approval before scheduling.');
      await loadStatus();
    } catch (err: unknown) {
      setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to enable social automation'));
    } finally {
      setSaving(false);
    }
  }

  async function runPrimaryAction() {
    if (!canUseOperator) return;
    const target = nextPlatform ?? activeSetup;
    if (!target) return;
    if (target.platform_code !== activePlatform) {
      setActivePlatform(target.platform_code);
      setMessage(`Review ${target.label} setup, then continue.`);
      return;
    }
    setActivePlatform(target.platform_code);
    if (target.next_action === 'configure_credentials') return saveCredentials(target.platform_code);
    if (target.next_action === 'connect_account') return startConnect(target.platform_code);
    if (target.next_action === 'select_account') return saveAccountSelection();
    if (status.next_action === 'enable_automation') return enableAutomation();
    return loadStatus();
  }

  const primaryDisabled = loading || saving || !canUseOperator || status.next_action === 'ready';
  const primaryLabel = !canUseOperator
    ? 'Select operator'
    : status.next_action === 'ready'
      ? 'Social Engine ready'
      : nextPlatform?.next_action === 'configure_credentials'
        ? `Save ${nextPlatform.label} credentials`
        : nextPlatform?.next_action === 'connect_account'
          ? `Connect ${nextPlatform.label}`
          : nextPlatform?.next_action === 'select_account'
            ? 'Save Meta account selection'
            : ACTION_LABELS[status.next_action] ?? 'Setup Social Engine';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Social Engine</h2>
          <p className="text-sm text-muted-foreground">
            One setup flow for operator-owned social apps, account connection, scheduling, and approval-first agent automation.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadStatus()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {loading ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Setup Social Engine
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure each operator&apos;s provider apps once, connect accounts, then let the optimizer and agents prepare posts for approval.
            </p>
          </div>
          <Button onClick={() => void runPrimaryAction()} disabled={primaryDisabled} className="min-w-[14rem]">
            {saving ? 'Working...' : primaryLabel}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin && (
            <div className="grid gap-2 md:max-w-xl">
              <label className="text-xs font-medium text-muted-foreground">Operator</label>
              <select
                className="w-full rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm outline-none focus:border-ring/60 dark:bg-black/20"
                value={selectedOperatorId}
                onChange={(event) => {
                  setSelectedOperatorId(event.target.value);
                  setMessage(null);
                  setError(null);
                }}
              >
                <option value="">Select operator</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}{operator.region ? ` (${operator.region})` : ''}
                  </option>
                ))}
              </select>
              {!selectedOperatorId && (
                <p className="text-xs text-amber-700 dark:text-amber-300">Select an operator to run setup with operator-owned credentials.</p>
              )}
              {operatorLoadError && <p className="text-xs text-rose-700 dark:text-rose-300">{operatorLoadError}</p>}
              {operatorLoadErrorKind === 'backend_unavailable' && (
                <p className="text-xs text-muted-foreground">Backend health must be restored before setup can continue.</p>
              )}
            </div>
          )}

          {message && <div className="rounded border border-green-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</div>}
          {error && <div className="rounded border border-red-500/30 bg-rose-500/10 p-2 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Credentials</p>
              <p className="mt-1 text-xl font-semibold">{configuredCount}/{status.platforms.length || PLATFORMS.length}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Connected</p>
              <p className="mt-1 text-xl font-semibold">{connectedCount}/{status.platforms.length || PLATFORMS.length}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Ready Channels</p>
              <p className="mt-1 text-xl font-semibold">{readyCount}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Automation</p>
              <p className="mt-1 text-xl font-semibold">{status.automation.enabled ? 'On' : 'Off'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cable className="h-5 w-5" />
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {(status.platforms.length > 0 ? status.platforms : PLATFORMS.map((item) => ({
              platform_code: item.code,
              label: item.label,
              credential_configured: false,
              credential_missing_fields: [],
              credential_fields: {},
              connection_status: 'disconnected' as SocialConnectionStatus,
              connection_reason: null,
              connected: false,
              can_schedule: false,
              can_publish: false,
              setup_ready: false,
              next_action: 'configure_credentials' as NextAction,
            }))).map((platform) => (
              <button
                key={platform.platform_code}
                type="button"
                onClick={() => setActivePlatform(platform.platform_code)}
                className={`rounded-md border p-3 text-left transition hover:border-primary/60 ${
                  activePlatform === platform.platform_code ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{platform.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {platform.can_publish ? 'API publishing' : 'Setup required'} · {platform.can_schedule ? 'Scheduler ready' : 'Scheduler gated'}
                    </p>
                  </div>
                  <Badge className={`${statusBadgeClass(platform)} whitespace-nowrap`}>{platformStatusText(platform)}</Badge>
                </div>
                {platform.connection_reason && (
                  <p className="mt-2 line-clamp-2 text-xs text-amber-700 dark:text-amber-300">{platform.connection_reason}</p>
                )}
                {platform.credential_missing_fields.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">Missing: {platform.credential_missing_fields.join(', ')}</p>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {PLATFORMS.find((item) => item.code === activePlatform)?.label ?? activePlatform} Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {PLATFORM_FIELDS[activePlatform].map((field) => (
                <div key={field.key} className="grid gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                  <Input
                    type={field.secret ? 'password' : 'text'}
                    value={formValues[field.key] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveCredentials()} disabled={saving || !canUseOperator}>
                Save credentials
              </Button>
              <Button variant="outline" onClick={() => void startConnect()} disabled={saving || !canUseOperator || !activeSetup?.credential_configured}>
                {PLATFORMS.find((item) => item.code === activePlatform)?.connectLabel ?? 'Connect'}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await clientFetch(`/social/disconnect/${activePlatform}${operatorQuery}`, { method: 'POST' });
                  await loadStatus();
                }}
                disabled={saving || !activeSetup?.connected}
              >
                Disconnect
              </Button>
            </div>

            {activePlatform === 'meta' && activeSetup?.connected && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <p className="text-sm font-medium">Meta account selection</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose the Facebook Page that owns the Instagram professional account used for publishing.</p>
                {activeSetup.account_selection?.discovery_error && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{activeSetup.account_selection.discovery_error}</p>
                )}
                <select
                  className="mt-3 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-ring/60"
                  value={selectedPageId}
                  onChange={(event) => setSelectedPageId(event.target.value)}
                >
                  {(activeSetup.account_selection?.pages ?? []).map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name || page.id}
                      {page.instagram_business_account?.username ? ` · @${page.instagram_business_account.username}` : ''}
                    </option>
                  ))}
                </select>
                <Button className="mt-3" size="sm" onClick={() => void saveAccountSelection()} disabled={saving || !selectedPageId}>
                  Save account selection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">
              {status.automation.enabled ? 'Social publishing agent is enabled' : 'Social publishing agent is not enabled'}
            </p>
            <p className="text-sm text-muted-foreground">
              Agent drafts stay approval-first and flow into social optimization and scheduling.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void enableAutomation()} disabled={saving || !canUseOperator || readyCount === 0}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {status.automation.enabled ? 'Recheck automation' : 'Enable automation'}
            </Button>
            {readyCount === 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                <CircleAlert className="h-3.5 w-3.5" />
                Connect at least one ready channel first.
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
