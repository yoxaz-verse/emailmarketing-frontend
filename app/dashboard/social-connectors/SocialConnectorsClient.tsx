'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clientFetch } from '@/lib/client-fetch';

type SocialConnectionStatus = 'connected' | 'expired' | 'missing_scope' | 'disconnected';

type SocialConnection = {
  platform_code: string;
  status: SocialConnectionStatus;
  reason: string | null;
  scopes: string[];
  expires_at: string | null;
  metadata: Record<string, unknown>;
};

type SocialConnector = {
  code: string;
  name: string;
  status: 'manual_assisted' | 'api_enabled';
  auth_type: 'none' | 'oauth2' | 'api_key';
  can_schedule: boolean;
  can_publish: boolean;
  credentials_active: boolean;
  deep_link_url: string | null;
  metadata: Record<string, unknown>;
};
type Operator = {
  id: string;
  name: string;
  region?: string | null;
};
type OperatorLoadErrorKind = 'backend_unavailable' | 'unauthorized' | 'unknown';

const PLATFORM_ORDER = ['linkedin', 'meta', 'reddit', 'telegram', 'whatsapp'];
const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  meta: 'Meta',
  reddit: 'Reddit',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};
type UiStatus = SocialConnectionStatus | 'app_configured' | 'not_connected';
type GuideContent = {
  intro: string;
  support: string;
  requiresOauth: boolean;
  steps: string[];
  requiredValues: string[];
  verifySteps: string[];
};

const PLATFORM_GUIDES: Record<string, GuideContent> = {
  linkedin: {
    intro: 'Use OAuth to connect your LinkedIn account for direct API publishing.',
    support: 'Direct OAuth/API publishing is available now.',
    requiresOauth: true,
    steps: [
      'Click Connect to start LinkedIn OAuth.',
      'Approve the requested permissions in LinkedIn.',
      'Return to this page and click Refresh to sync the latest status.',
    ],
    requiredValues: [
      'No manual keys required here.',
      'OAuth grants are stored after approval.',
    ],
    verifySteps: [
      'Status badge should show Connected and ready.',
      'Auth should show oauth2 in capabilities.',
      'You should be able to publish LinkedIn posts without manual fallback.',
    ],
  },
  meta: {
    intro: 'Use OAuth to connect your Meta account for direct API publishing.',
    support: 'Direct OAuth/API publishing is available.',
    requiresOauth: true,
    steps: [
      'Create a Meta app in Facebook Developers.',
      'Collect your app credentials and page/business access token.',
      'Approve the requested permissions.',
    ],
    requiredValues: [
      'META_APP_ID',
      'META_APP_SECRET',
      'META_PAGE_ACCESS_TOKEN',
      'META_BUSINESS_ACCOUNT_ID',
    ],
    verifySteps: [
      'Status should show Connected and ready after callback.',
      'Connector should be available in social publishing.',
      'Reconnect if scope changes are required.',
    ],
  },
  reddit: {
    intro: 'Use OAuth to connect your Reddit account for direct API publishing.',
    support: 'Direct OAuth/API publishing is available.',
    requiresOauth: true,
    steps: [
      'Create a Reddit app from your Reddit developer account.',
      'Collect client id, client secret, and redirect URL details.',
      'Approve requested scopes in Reddit consent screen.',
    ],
    requiredValues: [
      'REDDIT_CLIENT_ID',
      'REDDIT_CLIENT_SECRET',
      'REDDIT_REDIRECT_URI',
      'REDDIT_USER_AGENT',
    ],
    verifySteps: [
      'Badge should show Connected and ready after callback.',
      'Connection metadata should include your Reddit identity.',
      'Reconnect if scopes are missing.',
    ],
  },
  telegram: {
    intro: 'Connect Telegram in one click using your configured bot token and chat id.',
    support: 'Direct API validation connect is available.',
    requiresOauth: true,
    steps: [
      'Create a bot using BotFather.',
      'Set bot token and target channel/group id in admin settings.',
      'Click Connect to validate bot access and bind this operator.',
    ],
    requiredValues: [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID',
      'TELEGRAM_PARSE_MODE',
    ],
    verifySteps: [
      'Status should show Connected and ready after validation.',
      'Connector metadata should show bot username.',
      'Reconnect after token/chat updates.',
    ],
  },
  whatsapp: {
    intro: 'Connect WhatsApp Business in one click using configured business access token.',
    support: 'Direct API validation connect is available.',
    requiresOauth: true,
    steps: [
      'Set up a WhatsApp Business account and Meta app.',
      'Collect phone number id, business account id, and access token.',
      'Save values in admin settings for either global or operator scope.',
    ],
    requiredValues: [
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_BUSINESS_ACCOUNT_ID',
      'WHATSAPP_ACCESS_TOKEN',
    ],
    verifySteps: [
      'Status should show Connected and ready after token validation.',
      'Metadata should capture business account context.',
      'Reconnect when credentials rotate.',
    ],
  },
};

function toTitle(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function platformLabel(code: string, fallback?: string | null): string {
  return fallback || PLATFORM_LABELS[code] || toTitle(code);
}

function socialAppSettingsUrl(platformCode: string, selectedOperatorId: string): string {
  const platform = encodeURIComponent(platformCode);
  if (!selectedOperatorId) return `/dashboard/admin/social-apps?platform=${platform}&scope=global`;
  return `/dashboard/admin/social-apps?operator_id=${encodeURIComponent(selectedOperatorId)}&platform=${platform}&scope=operator`;
}

function sortConnectors(connectors: SocialConnector[]): SocialConnector[] {
  return [...connectors].sort((a, b) => {
    const ai = PLATFORM_ORDER.indexOf(a.code);
    const bi = PLATFORM_ORDER.indexOf(b.code);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function statusBadge(status: SocialConnectionStatus | 'manual_assisted' | 'api_enabled' | 'app_configured' | 'not_connected') {
  if (status === 'connected' || status === 'api_enabled') return 'bg-green-600 text-white';
  if (status === 'app_configured') return 'bg-blue-600 text-white';
  if (status === 'expired') return 'bg-amber-600 text-white';
  if (status === 'missing_scope') return 'bg-orange-600 text-white';
  if (status === 'manual_assisted') return 'bg-blue-600 text-white';
  return 'bg-muted text-foreground dark:bg-slate-600 dark:text-white';
}

function statusLabel(status: UiStatus): string {
  if (status === 'connected') return 'Connected and ready';
  if (status === 'app_configured') return 'App configured';
  if (status === 'expired') return 'Connection expired';
  if (status === 'missing_scope') return 'Missing permission';
  return 'Not connected';
}

function mapSocialConnectorError(message: string, code?: string | null): {
  userMessage: string;
  technicalHint?: string;
  retryAdvice?: string;
} {
  const input = String(message || '').trim();
  const errorCode = String(code || '').trim();
  const lower = input.toLowerCase();

  if (
    errorCode === 'provider_permission_denied' ||
    lower.includes('access_denied') ||
    lower.includes('not enough permissions') ||
    lower.includes('missing_scope') ||
    lower.includes('missing permission') ||
    lower.includes('(403)')
  ) {
    const platformLabel = lower.includes('linkedin') ? 'LinkedIn' : 'Social platform';
    return {
      userMessage: `${platformLabel} connect failed because the app is missing required permissions. Check the configured scopes/products, then reconnect.`,
      technicalHint: input,
      retryAdvice: 'Update the platform app scopes/products in Configure, save, then click Connect again.',
    };
  }

  if (errorCode === 'provider_config_error') {
    return {
      userMessage: 'Social connect failed because the platform app configuration is incomplete or invalid. Check the saved credentials, redirect URI, and scopes, then reconnect.',
      technicalHint: input,
      retryAdvice: 'Open Configure, fix the app credentials and redirect URI, save, then click Connect again.',
    };
  }

  if (errorCode === 'oauth_state_error') {
    return {
      userMessage: 'Social connect session expired or is invalid. Start the connect flow again.',
      technicalHint: input,
      retryAdvice: 'Click Connect again to start a fresh authorization session.',
    };
  }

  if (
    errorCode === 'backend_unavailable' ||
    lower.includes('backend unavailable') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('request timed out') ||
    lower.includes('failed to fetch') ||
    lower.includes('503')
  ) {
    return {
      userMessage: 'Backend is currently unavailable. Please ensure the backend service is running, then click Refresh.',
      technicalHint: input,
      retryAdvice: 'Use Refresh after backend/service health is restored.',
    };
  }

  if (lower.includes('next_public_api_base_url')) {
    return {
      userMessage: 'API base URL is not configured correctly for this dashboard.',
      technicalHint: input,
    };
  }

  return { userMessage: input || 'Failed to load social connectors' };
}

function asMissingFields(metadata: Record<string, unknown> | undefined): string[] {
  const raw = metadata?.missing_fields;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v ?? '').trim()).filter(Boolean);
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
  const [connectors, setConnectors] = useState<SocialConnector[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorRetryAdvice, setErrorRetryAdvice] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const searchParams = useSearchParams();

  const isAdmin = role === 'admin' || role === 'superadmin';
  const hasOperators = operators.length > 0;
  const hasOperatorLoadFailure = Boolean(operatorLoadError);
  const canRunAdminScopedRead = !isAdmin || Boolean(selectedOperatorId);

  const connectionByPlatform = useMemo(
    () => new Map(connections.map((c) => [c.platform_code, c])),
    [connections]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorHint(null);
    setErrorRetryAdvice(null);
    try {
      if (isAdmin && !selectedOperatorId) {
        const connectorData = await clientFetch<SocialConnector[]>('/social/connectors');
        setConnectors(sortConnectors(connectorData ?? []));
        setConnections([]);
        return;
      }

      const query = isAdmin && selectedOperatorId
        ? `?operator_id=${encodeURIComponent(selectedOperatorId)}`
        : '';
      const [connectorData, connectionData] = await Promise.all([
        clientFetch<SocialConnector[]>(`/social/connectors${query}`),
        clientFetch<SocialConnection[]>(`/social/connections${query}`),
      ]);
      setConnectors(sortConnectors(connectorData ?? []));
      setConnections(connectionData ?? []);
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : 'Failed to load social connectors';
      const mapped = mapSocialConnectorError(rawMessage);
      setError(mapped.userMessage);
      setErrorHint(mapped.technicalHint ?? null);
      setErrorRetryAdvice(mapped.retryAdvice ?? null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedOperatorId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (isAdmin && !selectedOperatorId && operators.length === 1) {
      setSelectedOperatorId(String(operators[0]?.id ?? ''));
    }
  }, [isAdmin, operators, selectedOperatorId]);

  useEffect(() => {
    const connectError = searchParams.get('social_connect_error');
    const connectErrorCode = searchParams.get('social_connect_error_code');
    const connectedPlatform = searchParams.get('social_connected');

    if (connectError) {
      const mapped = mapSocialConnectorError(connectError, connectErrorCode);
      setError(`Social connect failed: ${mapped.userMessage}`);
      setErrorHint(mapped.technicalHint ?? null);
      setErrorRetryAdvice(mapped.retryAdvice ?? null);
    } else if (connectedPlatform) {
      setSuccessMessage(`${toTitle(connectedPlatform)} connected successfully.`);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Social Connectors</h2>
        <p className="text-sm text-muted-foreground">Manage platform integrations for LinkedIn, Meta, Reddit, Telegram, and WhatsApp.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Platform Integrations</CardTitle>
          <Button size="sm" variant="outline" onClick={() => void loadData()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent>
          {isAdmin && (
            <div className="mb-4 space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">Operator Context (required for connect)</label>
              <select
                className="w-full rounded-md border border-border/60 bg-muted/40 dark:bg-black/20 px-3 py-2 text-sm outline-none focus:border-ring/60"
                value={selectedOperatorId}
                onChange={(e) => setSelectedOperatorId(e.target.value)}
              >
                <option value="">Select operator</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}{operator.region ? ` (${operator.region})` : ''}
                  </option>
                ))}
              </select>
              {!selectedOperatorId && (
                <p className="text-xs text-amber-700 dark:text-amber-300 dark:text-amber-300">Select an operator to start a social connect flow. Configure opens global app settings until an operator is selected.</p>
              )}
              {isAdmin && hasOperatorLoadFailure && (
                <p className="text-xs text-rose-700 dark:text-rose-300">{operatorLoadError}</p>
              )}
              {isAdmin && !hasOperatorLoadFailure && !hasOperators && (
                <p className="text-xs text-amber-700 dark:text-amber-300 dark:text-amber-300">No operators available. Add/create operators first.</p>
              )}
              {isAdmin && operatorLoadErrorKind === 'backend_unavailable' && (
                <p className="text-xs text-muted-foreground">
                  Check backend health and API base URL, then click Refresh.
                </p>
              )}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 rounded border border-green-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-700 dark:text-emerald-300">{successMessage}</div>
          )}
          {error && (
            <div className="mb-4 rounded border border-red-500/30 bg-rose-500/10 p-2 text-sm text-rose-700 dark:text-rose-300">
              <p>{error}</p>
              {errorHint && <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/80">Technical hint: {errorHint}</p>}
              {errorRetryAdvice && <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/80">Retry: {errorRetryAdvice}</p>}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connectors.map((connector) => {
              const conn = connectionByPlatform.get(connector.code);
              const isConnected = conn?.status === 'connected';
              const isOauthSupported = ['linkedin', 'meta', 'reddit', 'telegram', 'whatsapp'].includes(connector.code);
              const oauthAppConfigured = isOauthSupported
                ? Boolean((connector.metadata as Record<string, unknown> | undefined)?.oauth_app_configured)
                : true;
              const appConfigured = Boolean((connector.metadata as Record<string, unknown> | undefined)?.app_configured);
              const missingFields = asMissingFields(connector.metadata as Record<string, unknown> | undefined);
              const effectiveStatus: UiStatus = conn?.status ?? (isAdmin && !selectedOperatorId && oauthAppConfigured ? 'app_configured' : 'not_connected');
              const guide = PLATFORM_GUIDES[connector.code] ?? {
                intro: 'Connector guide is not yet configured for this platform.',
                support: 'Check with engineering for platform-specific setup.',
                requiresOauth: false,
                steps: ['Open platform docs and collect required credentials.'],
                requiredValues: ['Platform credentials'],
                verifySteps: ['Refresh this page and confirm status is updated.'],
              };
              const isExpanded = expandedPlatform === connector.code;
              const label = platformLabel(connector.code, connector.name);
              const settingsUrl = socialAppSettingsUrl(connector.code, selectedOperatorId);

              return (
                <div key={connector.code} className="min-w-0 rounded-lg border border-border/60 bg-muted/30 dark:bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold">{label}</p>
                    <Badge className={`${statusBadge(effectiveStatus)} max-w-full whitespace-normal text-center`}>
                      {statusLabel(effectiveStatus)}
                    </Badge>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{guide.support}</p>

                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded border border-border/60 px-2 py-0.5">Auth: {connector.auth_type}</span>
                    <span className="rounded border border-border/60 px-2 py-0.5">Schedule: {connector.can_schedule ? 'Yes' : 'No'}</span>
                    <span className="rounded border border-border/60 px-2 py-0.5">Publish: {connector.can_publish ? 'Yes' : 'No'}</span>
                  </div>

                  {conn?.reason && (
                    <div className="mt-2 break-words rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300 dark:text-amber-200">
                      <p className="font-medium">Why not connected?</p>
                      <p className="mt-1">{conn.reason}</p>
                    </div>
                  )}
                  {isOauthSupported && isAdmin && selectedOperatorId && !oauthAppConfigured && (
                    <div className="mt-2 break-words rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300 dark:text-amber-200">
                      {label} app credentials are not configured for this operator. Open Configure and paste the provider app details first.
                    </div>
                  )}
                  {isAdmin && selectedOperatorId && !appConfigured && missingFields.length > 0 && (
                    <div className="mt-2 break-words rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300 dark:text-amber-200">
                      Missing {label} app config fields: {missingFields.join(', ')}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-w-[8.5rem]"
                      onClick={() => setExpandedPlatform((prev) => (prev === connector.code ? null : connector.code))}
                    >
                      {isExpanded ? 'Hide Guide' : 'Open Guide'}
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-[7rem]"
                        onClick={() => {
                          window.location.href = settingsUrl;
                        }}
                      >
                        Configure
                      </Button>
                    )}

                    {isOauthSupported && (
                      <Button
                        size="sm"
                        className="min-w-[7rem]"
                        disabled={isAdmin && (!selectedOperatorId || !hasOperators || hasOperatorLoadFailure || !oauthAppConfigured)}
                        onClick={() => {
                          const query = isAdmin && selectedOperatorId
                            ? `?operator_id=${encodeURIComponent(selectedOperatorId)}`
                            : '';
                          window.location.href = `/api/proxy/social/connect/${connector.code}${query}`;
                        }}
                      >
                        {isConnected ? 'Reconnect' : 'Connect'}
                      </Button>
                    )}

                  {isConnected && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-[7rem]"
                        onClick={async () => {
                          try {
                            if (isAdmin && !selectedOperatorId) {
                              setError('Select an operator before disconnecting this social integration.');
                              setErrorHint(null);
                              setErrorRetryAdvice('Select an operator, then disconnect the operator-specific connection.');
                              return;
                            }
                            const query = isAdmin && selectedOperatorId
                              ? `?operator_id=${encodeURIComponent(selectedOperatorId)}`
                              : '';
                            await clientFetch(`/social/disconnect/${connector.code}${query}`, { method: 'POST' });
                            await loadData();
                          } catch (err: unknown) {
                            const rawMessage = err instanceof Error ? err.message : 'Failed to disconnect platform';
                            const mapped = mapSocialConnectorError(rawMessage);
                            setError(mapped.userMessage);
                            setErrorHint(mapped.technicalHint ?? null);
                            setErrorRetryAdvice(mapped.retryAdvice ?? null);
                          }
                        }}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 rounded-lg border border-border/60 bg-muted/40 dark:bg-black/20 p-3 text-xs">
                      <p className="font-medium text-sm">Integration Guide</p>
                      <p className="mt-1 text-muted-foreground">{guide.intro}</p>
                      {isAdmin && (
                        <a
                          href={settingsUrl}
                          className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Open {label} configuration page
                        </a>
                      )}

                      <div className="mt-3">
                        <p className="font-medium">Setup steps</p>
                        <ol className="mt-1 list-decimal space-y-1 pl-4 text-muted-foreground">
                          {guide.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="mt-3">
                        <p className="font-medium">What to paste / keep ready</p>
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          {guide.requiredValues.map((valueKey) => (
                            <li key={valueKey} className="rounded border border-border/60 bg-muted/30 dark:bg-white/[0.02] px-2 py-1 font-mono text-[11px]">
                              {valueKey}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-3">
                        <p className="font-medium">How to verify integration</p>
                        <ol className="mt-1 list-decimal space-y-1 pl-4 text-muted-foreground">
                          {guide.verifySteps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <p className="mt-3 text-[11px] text-muted-foreground">
                        Status detection: this card reads from your live connector capability and OAuth connection state returned by `/social/connectors` and `/social/connections`.
                      </p>
                      {isAdmin && !canRunAdminScopedRead && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Select an operator to load operator-scoped connection status.
                        </p>
                      )}
                      {!isOauthSupported && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Note: Direct OAuth/API connect is not enabled yet for this platform, so status will stay Not connected until rollout.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
