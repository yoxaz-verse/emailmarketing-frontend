'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clientFetch } from '@/lib/client-fetch';
import { Check, Copy, ExternalLink } from 'lucide-react';

type Operator = { id: string; name: string; region?: string | null };
type Platform = 'linkedin' | 'meta' | 'reddit' | 'telegram' | 'whatsapp';

type PlatformConfigResponse = {
  configured: boolean;
  operator_id: string | null;
  platform_code: Platform;
  scope?: 'global' | 'operator';
  required_missing: string[];
  fields?: Record<string, string>;
};
type SetupGuide = {
  consoleLabel: string;
  consoleUrl: string;
  callbackPath?: string;
  alternateCallbackPath?: string;
  callbackNote?: string;
  fieldsToPaste: string[];
  permissions: string[];
  setupSteps: string[];
  verifySteps: string[];
};

const FALLBACK_BACKEND_BASE_URL = 'https://emarketing-backend.infra.obaol.com';

const PLATFORMS: { code: Platform; label: string }[] = [
  { code: 'linkedin', label: 'LinkedIn' },
  { code: 'meta', label: 'Meta (Facebook/Instagram)' },
  { code: 'reddit', label: 'Reddit' },
  { code: 'telegram', label: 'Telegram' },
  { code: 'whatsapp', label: 'WhatsApp' },
];
const OAUTH_PLATFORMS = new Set<Platform>(['linkedin', 'meta', 'reddit']);

const PLATFORM_FIELDS: Record<Platform, { key: string; label: string; secret?: boolean; placeholder?: string }[]> = {
  linkedin: [
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://emarketing-backend.infra.obaol.com/social/oauth2-credential/callback' },
    { key: 'scopes', label: 'Scopes (comma-separated)', placeholder: 'w_member_social,openid,profile' },
  ],
  meta: [
    { key: 'app_id', label: 'App ID' },
    { key: 'app_secret', label: 'App Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://emarketing-backend.infra.obaol.com/social/callback/meta' },
    { key: 'page_access_token', label: 'Page Access Token', secret: true },
    { key: 'business_account_id', label: 'Business Account ID' },
  ],
  reddit: [
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://emarketing-backend.infra.obaol.com/social/callback/reddit' },
    { key: 'user_agent', label: 'User Agent', placeholder: 'obaol-social-connector/1.0 by u_your_reddit_username' },
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

const PLATFORM_SETUP_GUIDES: Record<Platform, SetupGuide> = {
  linkedin: {
    consoleLabel: 'LinkedIn Developer Portal',
    consoleUrl: 'https://www.linkedin.com/developers/apps',
    callbackPath: '/social/oauth2-credential/callback',
    alternateCallbackPath: '/social/callback/linkedin',
    callbackNote: 'Use this exact URL in LinkedIn Auth settings under Authorized redirect URLs. It must match the saved Redirect URI exactly, with no trailing slash or different path.',
    fieldsToPaste: [
      'Client ID from the LinkedIn app Auth tab',
      'Client Secret from the LinkedIn app Auth tab',
      'Redirect URI shown below',
      'Scopes: w_member_social,openid,profile',
    ],
    permissions: ['w_member_social', 'openid', 'profile'],
    setupSteps: [
      'Open LinkedIn Developer Portal and create or select the app used for publishing.',
      'In Products, request/enable the product that grants member social posting access.',
      'In Auth, add the callback URL shown below as an Authorized redirect URL exactly as shown.',
      'Copy Client ID, Client Secret, Redirect URI, and scopes into this form, then save.',
    ],
    verifySteps: [
      'Go back to Social Connectors, select the operator, and click Connect for LinkedIn.',
      'Approve the LinkedIn permission screen.',
      'After redirect, Refresh should show Connected and ready.',
    ],
  },
  meta: {
    consoleLabel: 'Meta Developers',
    consoleUrl: 'https://developers.facebook.com/apps/',
    callbackPath: '/social/callback/meta',
    callbackNote: 'Use this exact URL in Facebook Login Valid OAuth Redirect URIs.',
    fieldsToPaste: [
      'App ID from Meta Developers',
      'App Secret from Meta Developers',
      'Redirect URI shown below',
      'Page Access Token if your publishing flow needs a page token',
      'Business Account ID for the connected business',
    ],
    permissions: ['pages_manage_posts', 'pages_read_engagement', 'business_management', 'instagram_basic'],
    setupSteps: [
      'Open Meta Developers and create or select the Facebook/Instagram publishing app.',
      'Add Facebook Login or the relevant Meta login product and add the callback URL shown below.',
      'Request the permissions listed here for the app mode you plan to use.',
      'Copy App ID, App Secret, Redirect URI, and business/page values into this form, then save.',
    ],
    verifySteps: [
      'Go back to Social Connectors, select the operator, and click Connect for Meta.',
      'Approve the Meta permission screen with the account/page that should publish.',
      'After redirect, Refresh should show Connected and ready.',
    ],
  },
  reddit: {
    consoleLabel: 'Reddit Apps',
    consoleUrl: 'https://www.reddit.com/prefs/apps',
    callbackPath: '/social/callback/reddit',
    callbackNote: 'Paste this exact URL into the redirect uri field on the Reddit app.',
    fieldsToPaste: [
      'Client ID shown under the Reddit app name',
      'Client Secret from the Reddit app',
      'Redirect URI shown below',
      'User Agent, for example: obaol-social-connector/1.0 by u_your_username',
    ],
    permissions: ['identity', 'submit'],
    setupSteps: [
      'Open Reddit Apps and create a new app for this integration.',
      'Choose web app if available for your account and paste the callback URL shown below.',
      'Copy the client ID, client secret, redirect URI, and a descriptive user agent into this form.',
      'Save the configuration before starting the Reddit connect flow.',
    ],
    verifySteps: [
      'Go back to Social Connectors, select the operator, and click Connect for Reddit.',
      'Approve identity and submit permissions in Reddit.',
      'After redirect, Refresh should show Connected and ready.',
    ],
  },
  telegram: {
    consoleLabel: 'BotFather in Telegram',
    consoleUrl: 'https://t.me/BotFather',
    fieldsToPaste: [
      'Bot Token from BotFather',
      'Chat ID for the channel, group, or chat where posts should go',
    ],
    permissions: ['Bot must be able to post in the target chat/channel'],
    setupSteps: [
      'Open BotFather in Telegram and create a bot with /newbot.',
      'Copy the bot token into this form.',
      'Add the bot to the target channel or group and give it permission to post.',
      'Find the target chat ID and paste it into this form, then save.',
    ],
    verifySteps: [
      'Go back to Social Connectors, select the operator, and click Connect for Telegram.',
      'The backend validates the bot token and chat access directly.',
      'Refresh should show Connected and ready with bot metadata.',
    ],
  },
  whatsapp: {
    consoleLabel: 'WhatsApp Cloud API Setup',
    consoleUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    fieldsToPaste: [
      'Phone Number ID from WhatsApp Cloud API setup',
      'Business Account ID from Meta Business settings',
      'Access Token with access to the WhatsApp business account',
    ],
    permissions: ['Token must be valid for the WhatsApp Business Account and phone number'],
    setupSteps: [
      'Open Meta WhatsApp Cloud API setup and choose the business/app used for messaging.',
      'Copy the Phone Number ID and WhatsApp Business Account ID.',
      'Create or copy an access token that can read the business account and send messages.',
      'Paste the values into this form, then save.',
    ],
    verifySteps: [
      'Go back to Social Connectors, select the operator, and click Connect for WhatsApp.',
      'The backend validates the token and business account directly.',
      'Refresh should show Connected and ready with business metadata.',
    ],
  },
};

function normalizePlatform(raw: string): Platform {
  return PLATFORMS.some((p) => p.code === raw) ? (raw as Platform) : 'linkedin';
}

function normalizeBaseUrl(value?: string): string {
  const candidate = String(value ?? '').trim();
  if (!candidate) return FALLBACK_BACKEND_BASE_URL;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return FALLBACK_BACKEND_BASE_URL;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return FALLBACK_BACKEND_BASE_URL;
  }
}

function buildCallbackUrl(path?: string): string | null {
  if (!path) return null;
  return `${normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL)}${path}`;
}

export default function SocialAppsSettingsClient({
  operators,
  initialOperatorId,
  initialPlatform,
  initialScope,
  loadError,
}: {
  operators: Operator[];
  initialOperatorId: string;
  initialPlatform: string;
  initialScope: string;
  loadError?: string;
}) {
  const router = useRouter();
  const [operatorId, setOperatorId] = useState(initialOperatorId);
  const [platform, setPlatform] = useState<Platform>(normalizePlatform(initialPlatform));
  const [scope, setScope] = useState<'global' | 'operator'>(initialScope === 'operator' ? 'operator' : 'global');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endpointAvailable, setEndpointAvailable] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedOperator = useMemo(() => operators.find((o) => o.id === operatorId), [operators, operatorId]);
  const activeFields = PLATFORM_FIELDS[platform];
  const activeGuide = PLATFORM_SETUP_GUIDES[platform];
  const platformLabel = PLATFORMS.find((p) => p.code === platform)?.label ?? platform;
  const callbackUrl = buildCallbackUrl(activeGuide.callbackPath);
  const alternateCallbackUrl = buildCallbackUrl(activeGuide.alternateCallbackPath);
  const isOauthPlatform = OAUTH_PLATFORMS.has(platform);
  const savedRedirectUri = String(fields.redirect_uri ?? '').trim();
  const linkedinRedirectToRegister = savedRedirectUri || callbackUrl || '';
  const connectDisabledReason = !isOauthPlatform
    ? null
    : !operatorId
      ? 'Select an operator before connecting this platform.'
      : !configured
        ? 'Save a complete configuration before connecting.'
        : null;

  useEffect(() => {
    if (scope === 'operator' && !operatorId && operators.length === 1) {
      setOperatorId(String(operators[0]?.id ?? ''));
    }
  }, [scope, operatorId, operators]);

  async function readConfig(activeOperatorId: string, activePlatform: Platform): Promise<PlatformConfigResponse> {
    const scopeQuery = `scope=${scope}`;
    const attempts = [
      `/admin/social-apps/${activePlatform}?${scopeQuery}${scope === 'operator' ? `&operator_id=${encodeURIComponent(activeOperatorId)}` : ''}`,
      `/admin/social-apps?platform=${encodeURIComponent(activePlatform)}&${scopeQuery}${scope === 'operator' ? `&operator_id=${encodeURIComponent(activeOperatorId)}` : ''}`,
    ];

    let lastError: unknown = null;
    for (const path of attempts) {
      try {
        return await clientFetch<PlatformConfigResponse>(path);
      } catch (err: unknown) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to load app config');
  }

  useEffect(() => {
    if (scope === 'operator' && !operatorId) {
      setFields({});
      setMissing([]);
      setConfigured(false);
      setEndpointAvailable(true);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const data = await readConfig(operatorId, platform);
        setFields(data.fields ?? {});
        setMissing(data.required_missing ?? []);
        setConfigured(Boolean(data.configured));
        setEndpointAvailable(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load app config';
        setEndpointAvailable(!msg.toLowerCase().includes('endpoint is not available'));
        setError(msg);
        setConfigured(false);
        setMissing([]);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [operatorId, platform, scope]);

  async function save() {
    if (scope === 'operator' && !operatorId) {
      setError('Select an operator first.');
      return;
    }
    if (!endpointAvailable) {
      setError('Social app settings endpoint is not available on backend. Please restart/update backend.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload: Record<string, unknown> = {
        scope,
      };
      if (scope === 'operator') payload.operator_id = operatorId;

      for (const def of activeFields) {
        const value = String(fields[def.key] ?? '').trim();
        if (value) payload[def.key] = value;
      }

      if (platform === 'linkedin') {
        const rawScopes = String(fields.scopes ?? '').trim();
        payload.scopes = rawScopes
          ? rawScopes.split(',').map((v) => v.trim()).filter(Boolean)
          : ['w_member_social', 'openid', 'profile'];
      }

      await clientFetch(`/admin/social-apps/${platform}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (platform === 'linkedin' && callbackUrl) {
        setMessage(`Saved successfully. Add this exact URL in LinkedIn Authorized redirect URLs, then click Connect LinkedIn: ${String(payload.redirect_uri ?? callbackUrl)}`);
      } else {
        setMessage('Saved successfully. Configuration is now active for this operator/platform.');
      }

      const refreshed = await readConfig(operatorId, platform);
      setFields(refreshed.fields ?? {});
      setMissing(refreshed.required_missing ?? []);
      setConfigured(Boolean(refreshed.configured));
      setEndpointAvailable(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save app config';
      setEndpointAvailable(!msg.toLowerCase().includes('endpoint is not available'));
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function connectPlatform() {
    if (!isOauthPlatform || connectDisabledReason) {
      setError(connectDisabledReason ?? 'This platform does not use an OAuth connect flow.');
      return;
    }

    window.location.href = `/api/proxy/social/connect/${platform}?operator_id=${encodeURIComponent(operatorId)}`;
  }

  async function copyValue(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
    } catch {
      setError('Could not copy to clipboard. Select the value and copy it manually.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Social App Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure per-operator credentials for LinkedIn, Meta, Reddit, Telegram, and WhatsApp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm space-y-1">
              <span>Configuration Scope</span>
              <select
                value={scope}
                onChange={(e) => {
                  const next = e.target.value === 'operator' ? 'operator' : 'global';
                  setScope(next);
                  const qp = operatorId
                    ? `?operator_id=${encodeURIComponent(operatorId)}&platform=${platform}&scope=${next}`
                    : `?platform=${platform}&scope=${next}`;
                  router.replace(`/dashboard/admin/social-apps${qp}`);
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              >
                <option value="global">Global default (all operators)</option>
                <option value="operator">Operator override</option>
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span>Operator</span>
              <select
                value={operatorId}
                onChange={(e) => {
                  const next = e.target.value;
                  setOperatorId(next);
                  router.replace(`/dashboard/admin/social-apps?operator_id=${encodeURIComponent(next)}&platform=${platform}&scope=${scope}`);
                }}
                disabled={scope !== 'operator'}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              >
                <option value="">Select operator</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}{operator.region ? ` (${operator.region})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm space-y-1">
              <span>Platform</span>
              <select
                value={platform}
                onChange={(e) => {
                  const next = normalizePlatform(e.target.value);
                  setPlatform(next);
                  const qp = operatorId ? `?operator_id=${encodeURIComponent(operatorId)}&platform=${next}&scope=${scope}` : `?platform=${next}&scope=${scope}`;
                  router.replace(`/dashboard/admin/social-apps${qp}`);
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              >
                {PLATFORMS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </label>
          </div>

          {scope === 'operator' && selectedOperator && (
            <p className="text-xs text-muted-foreground">
              Editing config for: <span className="font-medium text-foreground">{selectedOperator.name}</span>
            </p>
          )}
          {scope === 'global' && (
            <p className="text-xs text-muted-foreground">Editing global defaults used by all operators unless overridden.</p>
          )}

          {configured ? (
            <div className="rounded-md border border-green-500/30 bg-green-500/10 p-2 text-sm text-green-700 dark:text-green-300">
              Configured. Required fields are complete for this platform.
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-200">
              Missing required fields: {missing.length > 0 ? missing.join(', ') : scope === 'operator' && !operatorId ? 'select operator to load status' : 'unable to load status right now'}
            </div>
          )}

          {!endpointAvailable && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-300">
              Social app settings endpoint is not available on backend. Restart/update backend and refresh this page.
            </div>
          )}

          {message && <div className="rounded-md border border-green-500/30 bg-green-500/10 p-2 text-sm text-green-700 dark:text-green-300">{message}</div>}
          {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
          {loading && <p className="text-xs text-muted-foreground">Loading current configuration...</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scope === 'operator' && !operatorId ? (
            <p className="text-sm text-muted-foreground">Select an operator first.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeFields.map((def) => (
                  <label key={def.key} className="text-sm space-y-1">
                    <span>{def.label}</span>
                    <input
                      type={def.secret ? 'password' : 'text'}
                      value={fields[def.key] ?? ''}
                      placeholder={def.placeholder ?? ''}
                      onChange={(e) => setFields((prev) => ({ ...prev, [def.key]: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-2"
                    />
                    {platform === 'linkedin' && def.key === 'client_secret' && fields.client_secret === '***' && (
                      <span className="block text-xs text-muted-foreground">Secret is saved and stays hidden. Leave *** unchanged unless you want to replace it.</span>
                    )}
                    {platform === 'linkedin' && def.key === 'scopes' && (
                      <span className="block text-xs text-muted-foreground">Saved scopes reload here after saving. Use comma-separated values like w_member_social,openid,profile.</span>
                    )}
                  </label>
                ))}
              </div>

              {platform === 'linkedin' && linkedinRedirectToRegister && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Registered in LinkedIn?</p>
                  <p className="mt-1">
                    The LinkedIn app for this Client ID must include this exact Redirect URI before Connect will work:
                    <span className="ml-1 break-all font-mono text-xs">{linkedinRedirectToRegister}</span>
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void save()} disabled={saving || loading || !endpointAvailable}>
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                {isOauthPlatform && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={connectPlatform}
                    disabled={saving || loading || Boolean(connectDisabledReason)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Connect {platformLabel}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/social-connectors`)}
                >
                  Back To Social Connectors
                </Button>
              </div>
              {connectDisabledReason && isOauthPlatform && (
                <p className="text-xs text-muted-foreground">{connectDisabledReason}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">{PLATFORMS.find((p) => p.code === platform)?.label} setup checklist</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open the provider console, paste the required values, save this page, then connect from Social Connectors.
              </p>
            </div>
            <a
              href={activeGuide.consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border/50 bg-background/50 px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              {activeGuide.consoleLabel}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {callbackUrl && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Callback URL to paste</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{callbackUrl}</p>
                  {activeGuide.callbackNote && <p className="mt-2 text-xs text-muted-foreground">{activeGuide.callbackNote}</p>}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyValue(callbackUrl, `${platform}-callback`)}
                  className="shrink-0"
                >
                  {copiedKey === `${platform}-callback` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedKey === `${platform}-callback` ? 'Copied' : 'Copy'}
                </Button>
              </div>

              {alternateCallbackUrl && (
                <div className="mt-3 flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 p-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">Alternate callback</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{alternateCallbackUrl}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyValue(alternateCallbackUrl, `${platform}-alternate-callback`)}
                    className="shrink-0"
                  >
                    {copiedKey === `${platform}-alternate-callback` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedKey === `${platform}-alternate-callback` ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <p className="text-sm font-medium">Fields To Paste</p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {activeGuide.fieldsToPaste.map((item) => (
                  <li key={item} className="rounded border border-border/50 bg-background/40 px-2 py-1.5">{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <p className="text-sm font-medium">Permissions / Scopes</p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {activeGuide.permissions.map((item) => (
                  <li key={item} className="rounded border border-border/50 bg-background/40 px-2 py-1.5 font-mono text-xs">{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <p className="text-sm font-medium">Verify After Saving</p>
              <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
                {activeGuide.verifySteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <p className="text-sm font-medium">Provider Steps</p>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
              {activeGuide.setupSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
