'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clientFetch } from '@/lib/client-fetch';

type Operator = { id: string; name: string; region?: string | null };
type Platform = 'linkedin' | 'meta' | 'reddit' | 'telegram' | 'whatsapp';

type PlatformConfigResponse = {
  configured: boolean;
  operator_id: string;
  platform_code: Platform;
  required_missing: string[];
  fields?: Record<string, string>;
};

const PLATFORMS: { code: Platform; label: string }[] = [
  { code: 'linkedin', label: 'LinkedIn' },
  { code: 'meta', label: 'Meta (Facebook/Instagram)' },
  { code: 'reddit', label: 'Reddit' },
  { code: 'telegram', label: 'Telegram' },
  { code: 'whatsapp', label: 'WhatsApp' },
];

const PLATFORM_FIELDS: Record<Platform, { key: string; label: string; secret?: boolean; placeholder?: string }[]> = {
  linkedin: [
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI', placeholder: 'https://your-api/social/callback/linkedin' },
    { key: 'scopes', label: 'Scopes (comma-separated)', placeholder: 'w_member_social,r_liteprofile' },
  ],
  meta: [
    { key: 'app_id', label: 'App ID' },
    { key: 'app_secret', label: 'App Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI' },
    { key: 'page_access_token', label: 'Page Access Token', secret: true },
    { key: 'business_account_id', label: 'Business Account ID' },
  ],
  reddit: [
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client Secret', secret: true },
    { key: 'redirect_uri', label: 'Redirect URI' },
    { key: 'user_agent', label: 'User Agent' },
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

function normalizePlatform(raw: string): Platform {
  return PLATFORMS.some((p) => p.code === raw) ? (raw as Platform) : 'linkedin';
}

export default function SocialAppsSettingsClient({
  operators,
  initialOperatorId,
  initialPlatform,
  loadError,
}: {
  operators: Operator[];
  initialOperatorId: string;
  initialPlatform: string;
  loadError?: string;
}) {
  const router = useRouter();
  const [operatorId, setOperatorId] = useState(initialOperatorId);
  const [platform, setPlatform] = useState<Platform>(normalizePlatform(initialPlatform));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endpointAvailable, setEndpointAvailable] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError ?? null);

  const selectedOperator = useMemo(() => operators.find((o) => o.id === operatorId), [operators, operatorId]);

  async function readConfig(activeOperatorId: string, activePlatform: Platform): Promise<PlatformConfigResponse> {
    const attempts = [
      `/admin/social-apps/${activePlatform}?operator_id=${encodeURIComponent(activeOperatorId)}`,
      `/admin/social-apps?platform=${encodeURIComponent(activePlatform)}&operator_id=${encodeURIComponent(activeOperatorId)}`,
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
    if (!operatorId) {
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
  }, [operatorId, platform]);

  const activeFields = PLATFORM_FIELDS[platform];

  async function save() {
    if (!operatorId) {
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
        operator_id: operatorId,
      };

      for (const def of activeFields) {
        const value = String(fields[def.key] ?? '').trim();
        if (value) payload[def.key] = value;
      }

      if (platform === 'linkedin') {
        const rawScopes = String(fields.scopes ?? '').trim();
        payload.scopes = rawScopes
          ? rawScopes.split(',').map((v) => v.trim()).filter(Boolean)
          : ['w_member_social', 'r_liteprofile'];
      }

      await clientFetch(`/admin/social-apps/${platform}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setMessage('Saved successfully. Configuration is now active for this operator/platform.');

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm space-y-1">
              <span>Operator</span>
              <select
                value={operatorId}
                onChange={(e) => {
                  const next = e.target.value;
                  setOperatorId(next);
                  router.replace(`/dashboard/admin/social-apps?operator_id=${encodeURIComponent(next)}&platform=${platform}`);
                }}
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
                  const qp = operatorId ? `?operator_id=${encodeURIComponent(operatorId)}&platform=${next}` : `?platform=${next}`;
                  router.replace(`/dashboard/admin/social-apps${qp}`);
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              >
                {PLATFORMS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </label>
          </div>

          {selectedOperator && (
            <p className="text-xs text-muted-foreground">
              Editing config for: <span className="font-medium text-foreground">{selectedOperator.name}</span>
            </p>
          )}

          {configured ? (
            <div className="rounded-md border border-green-500/30 bg-green-500/10 p-2 text-sm text-green-300">
              Configured. Required fields are complete for this platform.
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-200">
              Missing required fields: {missing.length > 0 ? missing.join(', ') : operatorId ? 'unable to load status right now' : 'select operator to load status'}
            </div>
          )}

          {!endpointAvailable && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-300">
              Social app settings endpoint is not available on backend. Restart/update backend and refresh this page.
            </div>
          )}

          {message && <div className="rounded-md border border-green-500/30 bg-green-500/10 p-2 text-sm text-green-300">{message}</div>}
          {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-300">{error}</div>}
          {loading && <p className="text-xs text-muted-foreground">Loading current configuration...</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!operatorId ? (
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
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={() => void save()} disabled={saving || loading || !endpointAvailable}>
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/social-connectors`)}
                >
                  Back To Social Connectors
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
