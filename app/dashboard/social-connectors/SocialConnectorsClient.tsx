'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { clientFetch } from '@/lib/client-fetch';
import { Bot, Cable, CheckCircle2, CircleAlert, ExternalLink, RefreshCw, Settings2, Zap } from 'lucide-react';

type SocialConnectionStatus = 'connected' | 'expired' | 'missing_scope' | 'identity_required' | 'disconnected';
type Operator = { id: string; name: string; region?: string | null };
type OperatorLoadErrorKind = 'backend_unavailable' | 'unauthorized' | 'unknown';
type Platform = 'linkedin' | 'facebook' | 'instagram' | 'reddit' | 'telegram' | 'whatsapp';
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
  credential_source?: 'operator' | 'global' | 'env' | 'missing';
  one_click_available?: boolean;
  credential_fields: Record<string, string>;
  connection_status: SocialConnectionStatus;
  connection_reason: string | null;
  authorization_saved?: boolean;
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

type SetupPreflight = {
  ok: boolean;
  code?: string;
  message?: string;
  error?: string;
};

const PLATFORMS: { code: Platform; label: string; connectLabel: string }[] = [
  { code: 'linkedin', label: 'LinkedIn', connectLabel: 'Connect LinkedIn' },
  { code: 'facebook', label: 'Facebook', connectLabel: 'Connect Facebook' },
  { code: 'instagram', label: 'Instagram', connectLabel: 'Connect Instagram' },
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
  facebook: [
    { key: 'app_id', label: 'Meta App ID' },
    { key: 'app_secret', label: 'Meta App Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://your-backend.com/social/callback/meta' },
  ],
  instagram: [
    { key: 'app_id', label: 'App ID' },
    { key: 'app_secret', label: 'App Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://your-backend.com/social/callback/meta' },
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

function mapSocialConnectorError(message: string, code?: string | null): string {
  const normalizedCode = String(code ?? '').trim().toLowerCase();
  if (normalizedCode === 'auth_service_misconfigured') {
    return 'Backend Supabase auth is misconfigured. Update the Supabase service role key/project config, restart backend, then try LinkedIn again.';
  }
  if (normalizedCode === 'auth_service_unavailable') {
    return 'Supabase is unavailable from the backend right now. Check backend connectivity, then try LinkedIn again.';
  }
  if (normalizedCode === 'social_oauth_schema_missing') {
    return 'Social connector setup is being updated. Apply the latest social OAuth database migration, then try connecting again.';
  }
  if (normalizedCode === 'provider_config_missing' || normalizedCode === 'provider_config_error') {
    return 'LinkedIn one-click connect needs the global OBAOL LinkedIn app credentials first.';
  }
  if (normalizedCode === 'oauth_state_error') {
    return 'LinkedIn returned, but the OAuth state was missing, expired, or invalid. Start Connect LinkedIn again from this page.';
  }
  if (normalizedCode === 'provider_permission_denied') {
    return 'LinkedIn rejected the connection because required permissions are missing or were denied. Confirm the app has w_member_social, then reconnect.';
  }

  const lower = String(message || '').toLowerCase();
  if (
    lower.includes('supabase rejected') ||
    lower.includes('unregistered api key') ||
    lower.includes('invalid api key') ||
    lower.includes('auth_service_misconfigured')
  ) {
    return 'Backend Supabase auth is misconfigured. Update the Supabase service role key/project config, restart backend, then try LinkedIn again.';
  }
  if (
    lower.includes('social oauth schema') ||
    lower.includes('social_oauth_schema_missing') ||
    (lower.includes('social_oauth_states') && lower.includes('requested_platform'))
  ) {
    return 'Social connector setup is being updated. Apply the latest social OAuth database migration, then try connecting again.';
  }
  if (lower.includes('nonexistent_version') || lower.includes('rejected api version') || lower.includes('version') && lower.includes('not active')) {
    return 'LinkedIn publishing used an expired API version. Update the backend LinkedIn API version and retry.';
  }
  if (lower.includes('backend unavailable') || lower.includes('failed to fetch') || lower.includes('timed out')) {
    return 'Backend is unavailable. Start or restart the backend service, then refresh this setup page.';
  }
  if (lower.includes('one-click') || lower.includes('global obaol linkedin app')) {
    return message;
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
  if (platform.platform_code === 'linkedin' && platform.connection_status === 'identity_required') return 'Identity needed';
  if ((platform.platform_code === 'facebook' || platform.platform_code === 'instagram') && platform.authorization_saved && platform.connection_status === 'identity_required') return 'Choose destination';
  if (platform.one_click_available && !platform.connected) return 'Ready to connect';
  if (!platform.credential_configured) return 'Credentials needed';
  if (!platform.connected) return 'Connect needed';
  if (platform.next_action === 'select_account') return 'Account selection';
  return ACTION_LABELS[platform.next_action] ?? toTitle(platform.connection_status);
}

function linkedInIdentityReason(reason: string | null): string {
  if (reason && /Enter the LinkedIn Member URN fallback/i.test(reason)) {
    return 'LinkedIn authorization was saved before detailed identity diagnostics were available. Recheck the saved authorization to identify the issue.';
  }
  return reason || 'LinkedIn access was saved, but the member identity could not be resolved.';
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
  const activeOneClick = Boolean(activeSetup?.one_click_available);
  const activeGlobalLinkedIn = activePlatform === 'linkedin' && activeOneClick && activeSetup?.credential_source !== 'operator';
  const activeMetaChannel = activePlatform === 'facebook' || activePlatform === 'instagram';
  const activeGlobalMeta = activeMetaChannel && activeOneClick;
  const activeMissingMeta = activeMetaChannel && !activeSetup?.credential_configured;
  const activeMissingLinkedIn = activePlatform === 'linkedin' && !activeSetup?.credential_configured;

  const nextPlatform = useMemo(() => {
    return status.platforms.find((platform) => platform.next_action === 'select_account')
      ?? status.platforms.find((platform) => platform.one_click_available && !platform.connected)
      ?? status.platforms.find((platform) => platform.next_action !== 'ready')
      ?? status.platforms[0]
      ?? null;
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
    const connectedPlatform = searchParams.get('social_connected') === 'meta' ? 'facebook' : searchParams.get('social_connected');
    const connectError = searchParams.get('social_connect_error');
    const connectErrorCode = searchParams.get('social_connect_error_code');
    if (connectedPlatform) {
      setMessage(`${toTitle(connectedPlatform)} authorization returned. Checking connection status...`);
      setActivePlatform(connectedPlatform as Platform);
    }
    if (connectError) {
      setError(mapSocialConnectorError(connectError, connectErrorCode));
    }
  }, [searchParams]);

  useEffect(() => {
    const connectedPlatform = (searchParams.get('social_connected') === 'meta' ? 'facebook' : searchParams.get('social_connected')) as Platform | null;
    if (!connectedPlatform || loading || status.platforms.length === 0) return;

    const platform = status.platforms.find((item) => item.platform_code === connectedPlatform);
    if (!platform) return;

    if (platform.setup_ready) {
      setError(null);
      setMessage(`${platform.label} connected and ready.`);
      return;
    }

    if (platform.connected) {
      setMessage(`${platform.label} connected. ${platformStatusText(platform)} is still required.`);
      return;
    }

    setMessage(null);
    setError(platform.platform_code === 'linkedin' && platform.connection_status === 'identity_required'
      ? linkedInIdentityReason(platform.connection_reason)
      : mapSocialConnectorError(platform.connection_reason || `${platform.label} did not finish connecting.`));
  }, [loading, searchParams, status.platforms]);

  useEffect(() => {
    const fields = activeSetup?.credential_fields ?? {};
    setFormValues(fields);
    if (activeSetup?.platform_code === 'facebook' || activeSetup?.platform_code === 'instagram') {
      setSelectedPageId(activeSetup.account_selection?.selected_page_id || activeSetup.account_selection?.pages?.find((page) => activeSetup.platform_code === 'facebook' || page.instagram_business_account?.id)?.id || '');
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
      const preflight = await clientFetch<SetupPreflight>('/social/setup/preflight', {
        method: 'POST',
        body: JSON.stringify({ operator_id: selectedOperatorId || undefined, platform }),
      });
      if (!preflight?.ok) {
        throw new Error(preflight?.message || preflight?.error || 'Social setup preflight failed');
      }
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
          channel: activePlatform,
          selected_instagram_account_id: activePlatform === 'instagram' ? page?.instagram_business_account?.id || undefined : undefined,
        }),
      });
      setMessage(`${activePlatform === 'instagram' ? 'Instagram' : 'Facebook'} destination saved.`);
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
    if (status.next_action === 'enable_automation') return enableAutomation();
    if (status.next_action === 'ready') return loadStatus();
    const target = nextPlatform ?? activeSetup;
    if (!target) return;
    if (target.platform_code !== activePlatform) {
      setActivePlatform(target.platform_code);
      setMessage(target.one_click_available ? `${target.label} is ready. Click Connect to continue.` : `Review ${target.label} setup, then continue.`);
      return;
    }
    setActivePlatform(target.platform_code);
    if (target.next_action === 'configure_credentials') {
      if (target.platform_code === 'linkedin') {
        if (isAdmin) {
          window.location.href = `/dashboard/admin/social-apps?operator_id=${encodeURIComponent(selectedOperatorId)}&platform=linkedin&scope=global`;
          return;
        }
        setError('LinkedIn one-click connect is not configured yet. Ask an admin to configure the global OBAOL LinkedIn app.');
        return;
      }
      return saveCredentials(target.platform_code);
    }
    if (target.next_action === 'connect_account') return startConnect(target.platform_code);
    if (target.next_action === 'select_account') return saveAccountSelection();
    return loadStatus();
  }

  const primaryDisabled = loading || saving || !canUseOperator || status.next_action === 'ready';
  const primaryLabel = !canUseOperator
    ? 'Select operator'
    : status.next_action === 'ready'
      ? 'Social Engine ready'
      : nextPlatform?.next_action === 'select_account'
        ? `Choose ${nextPlatform.label} destination`
        : nextPlatform?.one_click_available && !nextPlatform.connected
        ? `Connect ${nextPlatform.label}`
        : nextPlatform?.next_action === 'configure_credentials'
          ? nextPlatform.platform_code === 'linkedin'
            ? 'Configure LinkedIn app'
            : `Save ${nextPlatform.label} credentials`
        : nextPlatform?.next_action === 'connect_account'
          ? `Connect ${nextPlatform.label}`
          : ACTION_LABELS[status.next_action] ?? 'Setup Social Engine';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Social Engine</h2>
          <p className="text-sm text-muted-foreground">
            Connect operator channels with OBAOL-managed app credentials, then schedule and approve agent-prepared posts.
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
              Choose an operator, connect at least one channel, then let the optimizer and agents prepare posts for approval.
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
                <p className="text-xs text-amber-700 dark:text-amber-300">Select an operator to connect channels.</p>
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
              credential_source: 'missing' as const,
              one_click_available: false,
              credential_fields: {},
              connection_status: 'disconnected' as SocialConnectionStatus,
              connection_reason: null,
              authorization_saved: false,
              connected: false,
              can_schedule: false,
              can_publish: false,
              setup_ready: false,
              next_action: 'configure_credentials' as NextAction,
            }))).map((platform) => (
              <div
                key={platform.platform_code}
                className={`min-w-0 rounded-md border p-3 transition hover:border-primary/60 ${
                  activePlatform === platform.platform_code ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActivePlatform(platform.platform_code)}
                  className="block w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{platform.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {platform.platform_code === 'linkedin' && platform.connection_status === 'identity_required'
                          ? 'Publishing paused · Reconnect required'
                          : `${platform.can_publish ? 'API publishing' : 'Setup required'} · ${platform.can_schedule ? 'Scheduler ready' : 'Scheduler gated'}`}
                      </p>
                      {platform.credential_source && platform.credential_source !== 'missing' && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {platform.credential_source === 'operator' ? 'Operator app configured' : 'OBAOL app configured'}
                        </p>
                      )}
                    </div>
                    <Badge className={`${statusBadgeClass(platform)} whitespace-nowrap`}>{platformStatusText(platform)}</Badge>
                  </div>
                  {platform.connection_reason && !(platform.platform_code === 'linkedin' && platform.connection_status === 'identity_required') && (
                    <p className="mt-2 line-clamp-2 text-xs text-amber-700 dark:text-amber-300">{platform.connection_reason}</p>
                  )}
                  {platform.credential_missing_fields.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">Missing: {platform.credential_missing_fields.join(', ')}</p>
                  )}
                </button>
                {platform.platform_code === 'linkedin' && platform.connection_status === 'identity_required' && (
                  <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-sm">
                    <p className="text-amber-700 dark:text-amber-300">
                      {linkedInIdentityReason(platform.connection_reason)}
                    </p>
                    <p className="text-muted-foreground">Publishing is paused until LinkedIn returns a valid member ID. Resolve the issue above before retrying.</p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-1 max-w-full"
                      onClick={() => void startConnect('linkedin')}
                      disabled={saving || !canUseOperator || !platform.credential_configured}
                    >
                      Retry LinkedIn authorization
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setSaving(true);
                        setError(null);
                        setMessage(null);
                        try {
                          await clientFetch(`/social/linkedin/recheck-identity${operatorQuery}`, { method: 'POST' });
                          await loadStatus();
                        } catch (err: unknown) {
                          setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to recheck LinkedIn identity'));
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving || !canUseOperator}
                    >
                      Recheck saved authorization
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      The Member URN field in Setup is an advanced fallback, not a normal connection step.
                    </p>
                  </div>
                )}
              </div>
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
            {activeGlobalLinkedIn ? (
              <div className="rounded-md border border-green-500/30 bg-emerald-500/10 p-3">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  LinkedIn is ready for one-click connection.
                </p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  OBAOL&apos;s LinkedIn app is already configured. The operator only needs to approve access.
                </p>
              </div>
            ) : activeMissingLinkedIn ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  LinkedIn one-click connect needs the global OBAOL app first.
                </p>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  Configure the LinkedIn client ID, secret, callback, and scopes once in admin settings.
                </p>
              </div>
            ) : activeGlobalMeta ? (
              <div className="rounded-md border border-green-500/30 bg-emerald-500/10 p-3 text-sm">
                The OBAOL Meta app is configured. Authorize once, then choose this channel&apos;s destination below.
              </div>
            ) : activeMissingMeta ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                Configure the shared OBAOL Meta app in Social App Settings before connecting Facebook or Instagram.
              </div>
            ) : (
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
            )}

            <div className="flex flex-wrap gap-2">
              {!activeGlobalLinkedIn && !activeGlobalMeta && !activeMissingLinkedIn && !activeMissingMeta && (
                <Button onClick={() => void saveCredentials()} disabled={saving || !canUseOperator}>
                  Save credentials
                </Button>
              )}
              <Button variant={activeOneClick ? 'default' : 'outline'} onClick={() => void startConnect()} disabled={saving || !canUseOperator || !activeSetup?.credential_configured}>
                {PLATFORMS.find((item) => item.code === activePlatform)?.connectLabel ?? 'Connect'}
              </Button>
              {activeMissingLinkedIn && isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/dashboard/admin/social-apps?operator_id=${encodeURIComponent(selectedOperatorId)}&platform=linkedin&scope=global`;
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Configure LinkedIn app
                </Button>
              )}
              {activeMissingMeta && isAdmin && (
                <Button variant="outline" onClick={() => { window.location.href = `/dashboard/admin/social-apps?operator_id=${encodeURIComponent(selectedOperatorId)}&platform=meta&scope=global`; }}>
                  <ExternalLink className="h-4 w-4" /> Configure Meta app
                </Button>
              )}
              <Button
                variant="outline"
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  setMessage(null);
                  try {
                    await clientFetch(`/social/disconnect/${activePlatform}${operatorQuery}`, { method: 'POST' });
                    await loadStatus();
                    const url = new URL(window.location.href);
                    url.searchParams.delete('social_connected');
                    url.searchParams.delete('social_connect_error');
                    url.searchParams.delete('social_connect_error_code');
                    window.history.replaceState(window.history.state, '', url.toString());
                    setMessage(`${PLATFORMS.find((item) => item.code === activePlatform)?.label ?? activePlatform} disconnected.`);
                  } catch (err: unknown) {
                    setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to disconnect social platform'));
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || (activeMetaChannel
                  ? !activeSetup?.account_selection?.selected_page_id
                  : !(activeSetup?.authorization_saved || (activeSetup?.connection_status && activeSetup.connection_status !== 'disconnected')))}
              >
                Disconnect
              </Button>
            </div>

            {activeMetaChannel && activeSetup?.authorization_saved && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <p className="text-sm font-medium">{activePlatform === 'facebook' ? 'Facebook Page' : 'Instagram professional account'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{activePlatform === 'facebook' ? 'Choose the Page used for Facebook publishing.' : 'Choose a Page linked to the Instagram professional account used for publishing.'}</p>
                {activeSetup.account_selection?.discovery_error && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{activeSetup.account_selection.discovery_error}</p>
                )}
                <select
                  className="mt-3 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-ring/60"
                  value={selectedPageId}
                  onChange={(event) => setSelectedPageId(event.target.value)}
                >
                  {(activeSetup.account_selection?.pages ?? []).filter((page) => activePlatform === 'facebook' || Boolean(page.instagram_business_account?.id)).map((page) => (
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
