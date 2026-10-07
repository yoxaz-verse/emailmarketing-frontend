'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clientFetch } from '@/lib/client-fetch';
import { Bot, Cable, Check, CheckCircle2, CircleAlert, ExternalLink, Facebook, Instagram, Linkedin, MessageCircle, RefreshCw, Send, Settings2, Share2, X } from 'lucide-react';

type SocialConnectionStatus = 'connected' | 'expired' | 'missing_scope' | 'identity_required' | 'disconnected';
type Operator = { id: string; name: string; region?: string | null };
type OperatorLoadErrorKind = 'backend_unavailable' | 'unauthorized' | 'unknown';
type Platform = 'linkedin' | 'facebook' | 'instagram' | 'reddit' | 'telegram' | 'whatsapp';
type NextAction = 'select_operator' | 'configure_credentials' | 'connect_account' | 'select_account' | 'enable_automation' | 'ready';
type UiState = 'connected' | 'action_required' | 'reconnect' | 'connect' | 'unavailable';
type MetaPage = { id: string; name: string; instagram_business_account?: { id?: string; username?: string; name?: string } | null };

type PlatformSetup = {
  platform_code: Platform;
  label: string;
  credential_configured: boolean;
  credential_missing_fields: string[];
  credential_source?: 'operator' | 'global' | 'env' | 'missing';
  one_click_available?: boolean;
  connection_status: SocialConnectionStatus;
  connection_reason: string | null;
  reconnect_reason?: string | null;
  authorization_saved?: boolean;
  connected: boolean;
  can_schedule: boolean;
  can_publish: boolean;
  setup_ready: boolean;
  next_action: NextAction;
  ui_state?: UiState;
  selection_required?: boolean;
  connected_identity?: { id?: string | null; display_name: string; username?: string | null; kind: string } | null;
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
type SetupPreflight = { ok: boolean; code?: string; message?: string; error?: string };

const PLATFORMS: { code: Platform; label: string; helper: string }[] = [
  { code: 'instagram', label: 'Instagram', helper: 'Professional accounts' },
  { code: 'facebook', label: 'Facebook', helper: 'Pages' },
  { code: 'linkedin', label: 'LinkedIn', helper: 'Member publishing' },
  { code: 'reddit', label: 'Reddit', helper: 'Profile publishing' },
  { code: 'telegram', label: 'Telegram', helper: 'Bot and channel' },
  { code: 'whatsapp', label: 'WhatsApp', helper: 'Business account' },
];
const PLATFORM_STYLES: Record<Platform, string> = {
  instagram: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white',
  facebook: 'bg-blue-600 text-white',
  linkedin: 'bg-sky-700 text-white',
  reddit: 'bg-orange-600 text-white',
  telegram: 'bg-cyan-500 text-white',
  whatsapp: 'bg-emerald-600 text-white',
};

function PlatformIcon({ platform, className = 'h-5 w-5' }: { platform: Platform; className?: string }) {
  if (platform === 'instagram') return <Instagram className={className} />;
  if (platform === 'facebook') return <Facebook className={className} />;
  if (platform === 'linkedin') return <Linkedin className={className} />;
  if (platform === 'telegram') return <Send className={className} />;
  if (platform === 'whatsapp') return <MessageCircle className={className} />;
  return <Share2 className={className} />;
}

function emptyStatus(operatorId: string | null): SetupStatus {
  return { operator_id: operatorId, ready: false, next_action: operatorId ? 'configure_credentials' : 'select_operator', automation: { enabled: false, agent_id: null, mission_id: null }, platforms: [] };
}

function mapSocialConnectorError(message: string, code?: string | null): string {
  const lower = String(message || '').toLowerCase();
  const normalizedCode = String(code ?? '').trim().toLowerCase();
  if (normalizedCode === 'provider_permission_denied' || lower.includes('permission') || lower.includes('scope')) return 'Access was not granted for every required permission. Reconnect and approve Page and Instagram publishing access.';
  if (normalizedCode === 'oauth_state_error') return 'This connection request expired or was already used. Start the connection again.';
  if (normalizedCode === 'provider_config_missing' || normalizedCode === 'provider_config_error') return 'This connection is not available yet. An administrator must finish the provider setup.';
  if (normalizedCode === 'social_oauth_schema_missing') return 'Social connections are being updated. Ask an administrator to apply the latest database migration.';
  if (normalizedCode === 'auth_service_misconfigured' || normalizedCode === 'auth_service_unavailable') return 'The connection service is temporarily unavailable. Ask an administrator to check the backend configuration.';
  if (lower.includes("can't load url") || lower.includes('redirect uri')) return 'Meta rejected the callback URL. An administrator must verify the configured OAuth redirect URI.';
  if (lower.includes('failed to fetch') || lower.includes('backend unavailable') || lower.includes('timed out')) return 'The backend is unavailable. Please try again after the service is restored.';
  return message || 'The social account could not be connected.';
}

function uiState(platform: PlatformSetup): UiState {
  if (platform.ui_state) return platform.ui_state;
  if (platform.connected) return 'connected';
  if (platform.selection_required) return 'action_required';
  if (platform.connection_status === 'expired' || platform.connection_status === 'missing_scope') return 'reconnect';
  return platform.credential_configured ? 'connect' : 'unavailable';
}

function stateLabel(platform: PlatformSetup): string {
  const state = uiState(platform);
  if (state === 'connected') return 'Connected';
  if (state === 'action_required') return 'Action required';
  if (state === 'reconnect') return 'Reconnect';
  if (state === 'unavailable') return 'Needs admin setup';
  return 'Connect';
}

function badgeClass(platform: PlatformSetup): string {
  const state = uiState(platform);
  if (state === 'connected') return 'bg-emerald-600 text-white';
  if (state === 'action_required' || state === 'reconnect') return 'bg-amber-500 text-white';
  if (state === 'unavailable') return 'bg-slate-500 text-white';
  return 'bg-primary text-primary-foreground';
}

export default function SocialConnectorsClient({ role, operators = [], operatorLoadError, operatorLoadErrorKind }: {
  role?: string;
  operators?: Operator[];
  operatorLoadError?: string;
  operatorLoadErrorKind?: OperatorLoadErrorKind;
}) {
  const searchParams = useSearchParams();
  const callbackOperatorId = String(searchParams.get('operator_id') ?? '').trim();
  const callbackPlatformRaw = searchParams.get('social_connected') ?? searchParams.get('social_connect_platform');
  const callbackPlatform = (callbackPlatformRaw === 'meta' ? 'facebook' : callbackPlatformRaw) as Platform | null;
  const callbackError = searchParams.get('social_connect_error');
  const callbackErrorCode = searchParams.get('social_connect_error_code');
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [selectedOperatorId, setSelectedOperatorId] = useState(callbackOperatorId);
  const [status, setStatus] = useState<SetupStatus>(() => emptyStatus(callbackOperatorId || null));
  const [activePlatform, setActivePlatform] = useState<Platform>(callbackPlatform ?? 'instagram');
  const [modalOpen, setModalOpen] = useState(Boolean(callbackPlatform || callbackError));
  const [callbackPending, setCallbackPending] = useState(Boolean(callbackPlatform || callbackError));
  const [selectedPageId, setSelectedPageId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(callbackPlatform ? 'Authorization returned. Checking your account…' : null);
  const [error, setError] = useState<string | null>(callbackError ? mapSocialConnectorError(callbackError, callbackErrorCode) : null);
  const canUseOperator = !isAdmin || Boolean(selectedOperatorId);
  const activeSetup = status.platforms.find((platform) => platform.platform_code === activePlatform) ?? null;
  const readyCount = status.platforms.filter((platform) => platform.setup_ready).length;
  const connectedCount = status.platforms.filter((platform) => platform.connected).length;
  const eligiblePages = useMemo(() => {
    const pages = activeSetup?.account_selection?.pages ?? [];
    return activePlatform === 'instagram' ? pages.filter((page) => Boolean(page.instagram_business_account?.id)) : pages;
  }, [activePlatform, activeSetup]);
  const operatorQuery = isAdmin && selectedOperatorId ? `?operator_id=${encodeURIComponent(selectedOperatorId)}` : '';

  const loadStatus = useCallback(async () => {
    if (!canUseOperator) { setStatus(emptyStatus(null)); return; }
    setLoading(true);
    try {
      const query = isAdmin && selectedOperatorId ? `?operator_id=${encodeURIComponent(selectedOperatorId)}` : '';
      const data = await clientFetch<SetupStatus>(`/social/setup/status${query}`);
      setStatus(data ?? emptyStatus(selectedOperatorId || null));
    } catch (err: unknown) {
      setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to load social connections'));
    } finally { setLoading(false); }
  }, [canUseOperator, isAdmin, selectedOperatorId]);

  useEffect(() => { if (isAdmin && !selectedOperatorId && operators.length === 1) setSelectedOperatorId(String(operators[0]?.id ?? '')); }, [isAdmin, operators, selectedOperatorId]);
  useEffect(() => { if (isAdmin && callbackOperatorId && callbackOperatorId !== selectedOperatorId) setSelectedOperatorId(callbackOperatorId); }, [callbackOperatorId, isAdmin, selectedOperatorId]);
  useEffect(() => { void loadStatus(); }, [loadStatus]);
  useEffect(() => {
    if (!activeSetup || (activePlatform !== 'facebook' && activePlatform !== 'instagram')) return;
    setSelectedPageId(activeSetup.account_selection?.selected_page_id || '');
  }, [activePlatform, activeSetup]);
  useEffect(() => {
    if (!callbackPending || loading || status.platforms.length === 0) return;
    const platform = callbackPlatform ? status.platforms.find((item) => item.platform_code === callbackPlatform) : null;
    if (!callbackError && platform) {
      if (platform.setup_ready) { setError(null); setMessage(`${platform.label} is connected and ready.`); }
      else if (platform.selection_required) setMessage(`Choose the ${platform.label} account you want OBAOL to use.`);
      else { setMessage(null); setError(mapSocialConnectorError(platform.connection_reason || `${platform.label} did not finish connecting.`)); }
    }
    const url = new URL(window.location.href);
    ['social_connected', 'social_connect_platform', 'social_connect_error', 'social_connect_error_code'].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, '', url.toString());
    setCallbackPending(false);
  }, [callbackError, callbackPending, callbackPlatform, loading, status.platforms]);

  function openConnections(platform: Platform = 'instagram') { setActivePlatform(platform); setModalOpen(true); setMessage(null); setError(null); }

  async function startConnect(platform: Platform) {
    if (!canUseOperator) { setError('Select an operator before connecting an account.'); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      const preflight = await clientFetch<SetupPreflight>('/social/setup/preflight', { method: 'POST', body: JSON.stringify({ operator_id: selectedOperatorId || undefined, platform }) });
      if (!preflight?.ok) throw new Error(preflight?.message || preflight?.error || 'Connection preflight failed');
      const data = await clientFetch<{ redirect_url: string }>('/social/setup/start', { method: 'POST', body: JSON.stringify({ operator_id: selectedOperatorId || undefined, platform }) });
      if (!data?.redirect_url) throw new Error('The provider did not return an authorization URL.');
      window.sessionStorage.setItem('obaol_social_connect_platform', platform);
      window.location.href = data.redirect_url;
    } catch (err: unknown) {
      setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to start connection'));
      setSaving(false);
    }
  }

  async function saveAccountSelection(pageId: string) {
    const page = eligiblePages.find((item) => item.id === pageId);
    if (!page) return;
    setSelectedPageId(pageId); setSaving(true); setError(null);
    try {
      await clientFetch('/social/setup/account-selection', { method: 'POST', body: JSON.stringify({ operator_id: selectedOperatorId || undefined, selected_page_id: pageId, channel: activePlatform, selected_instagram_account_id: activePlatform === 'instagram' ? page.instagram_business_account?.id : undefined }) });
      await loadStatus();
      setMessage(`${activePlatform === 'instagram' ? 'Instagram' : 'Facebook'} is connected and ready.`);
    } catch (err: unknown) { setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to save account selection')); }
    finally { setSaving(false); }
  }

  async function disconnect(platform: Platform) {
    setSaving(true); setError(null);
    try {
      await clientFetch(`/social/disconnect/${platform}${operatorQuery}`, { method: 'POST' });
      await loadStatus();
      setMessage(`${PLATFORMS.find((item) => item.code === platform)?.label ?? platform} disconnected.`);
    } catch (err: unknown) { setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to disconnect account')); }
    finally { setSaving(false); }
  }

  async function enableAutomation() {
    setSaving(true); setError(null);
    try {
      await clientFetch('/social/setup/automation', { method: 'POST', body: JSON.stringify({ operator_id: selectedOperatorId || undefined, timezone: 'Asia/Kolkata' }) });
      await loadStatus(); setMessage('Social publishing automation is enabled.');
    } catch (err: unknown) { setError(mapSocialConnectorError(err instanceof Error ? err.message : 'Failed to enable automation')); }
    finally { setSaving(false); }
  }

  function configurePlatform(platform: Platform) {
    const configPlatform = platform === 'facebook' || platform === 'instagram' ? 'meta' : platform;
    window.location.href = `/dashboard/admin/social-apps?operator_id=${encodeURIComponent(selectedOperatorId)}&platform=${configPlatform}&scope=global`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Social connections</h2><p className="mt-1 text-sm text-muted-foreground">Connect your accounts once, then publish and schedule from OBAOL.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadStatus()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
          <Button onClick={() => openConnections()} disabled={!canUseOperator}><Cable className="mr-2 h-4 w-4" /> Connect social networks</Button>
        </div>
      </div>

      {isAdmin && <Card><CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
        <div className="grid w-full gap-1.5 md:max-w-xl"><label className="text-xs font-medium text-muted-foreground">Operator</label><select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={selectedOperatorId} onChange={(event) => { setSelectedOperatorId(event.target.value); setMessage(null); setError(null); }}><option value="">Select operator</option>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}{operator.region ? ` (${operator.region})` : ''}</option>)}</select>{operatorLoadError && <p className="text-xs text-rose-600">{operatorLoadError}</p>}{operatorLoadErrorKind === 'backend_unavailable' && <p className="text-xs text-muted-foreground">Restore backend health before continuing.</p>}</div>
        <Button variant="outline" disabled={!selectedOperatorId} onClick={() => configurePlatform('instagram')}><Settings2 className="mr-2 h-4 w-4" /> Provider settings</Button>
      </CardContent></Card>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="py-5"><p className="text-sm text-muted-foreground">Connected accounts</p><p className="mt-1 text-3xl font-semibold">{connectedCount}</p></CardContent></Card>
        <Card><CardContent className="py-5"><p className="text-sm text-muted-foreground">Ready to publish</p><p className="mt-1 text-3xl font-semibold">{readyCount}</p></CardContent></Card>
        <Card><CardContent className="py-5"><p className="text-sm text-muted-foreground">Automation</p><p className="mt-1 text-3xl font-semibold">{status.automation.enabled ? 'On' : 'Off'}</p></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Publishing automation</CardTitle></CardHeader><CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><p className="text-sm text-muted-foreground">Agent-prepared posts remain approval-first and use only connected, ready accounts.</p><Button onClick={() => void enableAutomation()} disabled={saving || readyCount === 0 || !canUseOperator}><CheckCircle2 className="mr-2 h-4 w-4" /> {status.automation.enabled ? 'Recheck automation' : 'Enable automation'}</Button></CardContent></Card>

      {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="social-connect-title">
        <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-7"><div><h3 id="social-connect-title" className="text-xl font-semibold">Connect your social networks</h3><p className="mt-1 text-sm text-muted-foreground">Authorize an account and OBAOL will securely finish the setup.</p></div><Button variant="outline" size="sm" aria-label="Close" onClick={() => setModalOpen(false)}><X className="h-4 w-4" /></Button></div>
          <div className="overflow-y-auto p-5 sm:p-7">
            {message && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</div>}
            {error && <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
            <div className="grid gap-3 md:grid-cols-2">
              {PLATFORMS.map((definition) => {
                const item = status.platforms.find((candidate) => candidate.platform_code === definition.code) ?? { platform_code: definition.code, label: definition.label, credential_configured: false, credential_missing_fields: [], connection_status: 'disconnected', connection_reason: null, connected: false, can_schedule: false, can_publish: false, setup_ready: false, next_action: 'configure_credentials', ui_state: 'unavailable' } as PlatformSetup;
                const state = uiState(item);
                const isActive = activePlatform === definition.code;
                return <div key={definition.code} className={`rounded-xl border p-4 transition ${isActive ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/40'}`}>
                  <button type="button" className="w-full text-left" onClick={() => { setActivePlatform(definition.code); setMessage(null); setError(null); }}><span className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${PLATFORM_STYLES[definition.code]}`}><PlatformIcon platform={definition.code} /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="font-medium">{definition.label}</span><Badge className={badgeClass(item)}>{stateLabel(item)}</Badge></span><span className="mt-1 block truncate text-xs text-muted-foreground">{item.connected_identity?.display_name || definition.helper}</span></span></span></button>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                    {state === 'connected' ? <><span className="mr-auto inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" /> Ready to publish</span><Button size="sm" variant="outline" onClick={() => void startConnect(definition.code)} disabled={saving}>Reconnect</Button><Button size="sm" variant="outline" onClick={() => void disconnect(definition.code)} disabled={saving}>Disconnect</Button></>
                    : state === 'unavailable' ? isAdmin ? <Button size="sm" variant="outline" onClick={() => configurePlatform(definition.code)}><ExternalLink className="mr-1 h-3.5 w-3.5" /> Configure</Button> : <span className="text-xs text-muted-foreground">Ask an administrator to configure this connection.</span>
                    : state === 'action_required' && (definition.code === 'instagram' || definition.code === 'facebook') ? <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><CircleAlert className="h-3.5 w-3.5" /> Select an account below</span>
                    : <Button size="sm" onClick={() => void startConnect(definition.code)} disabled={saving}>{state === 'reconnect' ? 'Reconnect' : `Connect ${definition.label}`}</Button>}
                  </div>
                </div>;
              })}
            </div>

            {(activePlatform === 'instagram' || activePlatform === 'facebook') && activeSetup?.authorization_saved && activeSetup.selection_required && <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
              <h4 className="font-medium">{activePlatform === 'instagram' ? 'Choose an Instagram professional account' : 'Choose a Facebook Page'}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{activePlatform === 'instagram' ? 'Only Business or Creator accounts linked to an authorized Facebook Page are shown.' : 'Select the Page OBAOL should publish to.'}</p>
              {activeSetup.account_selection?.discovery_error && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Meta could not list the available accounts. Reconnect and approve Page access.</p>}
              {eligiblePages.length === 0 ? <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">{activePlatform === 'instagram' ? 'No eligible Instagram professional account was found. Convert the account to Business or Creator, link it to a Facebook Page, then reconnect.' : 'No publishable Facebook Page was returned. Confirm Page access and reconnect.'}</div>
              : <div className="mt-4 grid gap-2 sm:grid-cols-2">{eligiblePages.map((page) => {
                const selected = selectedPageId === page.id;
                const identity = activePlatform === 'instagram' ? page.instagram_business_account : null;
                return <button key={page.id} type="button" disabled={saving} onClick={() => void saveAccountSelection(page.id)} className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${PLATFORM_STYLES[activePlatform]}`}><PlatformIcon platform={activePlatform} className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{identity?.username ? `@${identity.username}` : identity?.name || page.name || page.id}</span><span className="block truncate text-xs text-muted-foreground">{page.name || 'Facebook Page'}</span></span>{selected && <CheckCircle2 className="h-5 w-5 text-primary" />}</button>;
              })}</div>}
            </div>}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-4 sm:px-7"><span className="text-xs text-muted-foreground">OAuth credentials and tokens are stored server-side.</span><Button onClick={() => setModalOpen(false)}>Finish</Button></div>
        </div>
      </div>}
    </div>
  );
}
