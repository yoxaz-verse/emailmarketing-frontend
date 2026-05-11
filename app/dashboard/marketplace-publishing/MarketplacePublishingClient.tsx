'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Connector = {
  code: string;
  name: string;
  marketplace_status: 'public_api' | 'partner_api' | 'no_api_manual';
  auth_type: 'none' | 'api_key' | 'oauth2' | 'partner';
  can_create_draft: boolean;
  can_publish: boolean;
  can_update_price: boolean;
  can_update_inventory: boolean;
  supports_webhook: boolean;
  credentials_active: boolean;
  deep_link_url: string | null;
};

type PublishJob = {
  id: string;
  marketplace_code: string;
  status: string;
  phase: string;
  external_listing_id: string | null;
  external_listing_url: string | null;
  manual_task: Record<string, unknown> | null;
  partner_onboarding: Record<string, unknown> | null;
  error_message: string | null;
  timeline: { at: string; phase: string; status: string; message: string }[];
};

type PublishResponse = {
  request_id: string;
  idempotency_key: string;
  jobs: PublishJob[];
};

const defaultListing = {
  title: 'Premium Yellow Maize for Export',
  description: 'Grade A yellow maize, consistent moisture profile, export-ready packing.',
  category: 'Agricultural Commodities',
  specsJson: '{\n  "moisture": "<= 14%",\n  "origin": "India"\n}',
  moq: '100',
  price: '285',
  currency: 'USD',
  lead_time_days: '12',
  mediaCsv: 'https://example.com/maize-1.jpg,https://example.com/maize-2.jpg',
  complianceDocsCsv: 'https://example.com/coa.pdf',
  company_name: 'Obaol Agro Exports',
  contact_name: 'Trade Desk',
  country: 'India',
  email: 'trade@obaol.com',
  phone: '+91-9000000000',
};

function statusBadge(status: string) {
  if (status === 'published') return <Badge className="bg-green-600">Published</Badge>;
  if (status === 'manual_action_required') return <Badge variant="secondary">Manual Assisted</Badge>;
  if (status === 'partner_onboarding_required') return <Badge className="bg-amber-600">Partner Required</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function marketplaceBadge(status: Connector['marketplace_status']) {
  if (status === 'public_api') return <Badge className="bg-green-700">Live API</Badge>;
  if (status === 'partner_api') return <Badge className="bg-amber-700">Partner Required</Badge>;
  return <Badge variant="secondary">Manual Assisted</Badge>;
}

export default function MarketplacePublishingClient() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState(defaultListing);

  const loadConnectors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientFetch<Connector[]>('/marketplaces/connectors');
      setConnectors(data);
      const defaults: Record<string, boolean> = {};
      for (const item of data) defaults[item.code] = true;
      setSelected(defaults);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load connectors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnectors();
  }, [loadConnectors]);

  const chosenTargets = useMemo(
    () => connectors.filter((c) => selected[c.code]).map((c) => c.code),
    [connectors, selected]
  );

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const specs = JSON.parse(listing.specsJson || '{}');
      const payload = {
        targets: chosenTargets,
        listing_input: {
          title: listing.title,
          description: listing.description,
          category: listing.category,
          specs,
          moq: Number(listing.moq),
          price: Number(listing.price),
          currency: listing.currency,
          lead_time_days: Number(listing.lead_time_days),
          media: listing.mediaCsv.split(',').map((x) => x.trim()).filter(Boolean),
          compliance_docs: listing.complianceDocsCsv.split(',').map((x) => x.trim()).filter(Boolean),
          seller_profile: {
            company_name: listing.company_name,
            contact_name: listing.contact_name,
            country: listing.country,
            email: listing.email,
            phone: listing.phone,
          },
        },
      };

      const data = await clientFetch<PublishResponse>('/marketplaces/publish-jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const retryJob = async (jobId: string) => {
    try {
      const job = await clientFetch<PublishJob>(`/marketplaces/publish-jobs/${jobId}/retry`, {
        method: 'POST',
      });
      setResult((prev) => {
        if (!prev) return prev;
        return { ...prev, jobs: prev.jobs.map((j) => (j.id === job.id ? job : j)) };
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Marketplace Publishing Hub</h2>
        <p className="text-sm text-muted-foreground">Draft-first publishing across global B2B marketplaces with API-first and controlled fallback modes.</p>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Marketplace Picker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading connectors...</p>}
          {!loading && connectors.map((c) => (
            <label key={c.code} className="flex items-center justify-between rounded border p-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(selected[c.code])}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [c.code]: e.target.checked }))}
                />
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.code}</p>
                </div>
              </div>
              {marketplaceBadge(c.marketplace_status)}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unified Listing Input</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input value={listing.title} onChange={(e) => setListing({ ...listing, title: e.target.value })} placeholder="Title" />
          <Input value={listing.category} onChange={(e) => setListing({ ...listing, category: e.target.value })} placeholder="Category" />
          <Textarea value={listing.description} onChange={(e) => setListing({ ...listing, description: e.target.value })} placeholder="Description" className="md:col-span-2" />
          <Textarea value={listing.specsJson} onChange={(e) => setListing({ ...listing, specsJson: e.target.value })} placeholder="Specs JSON" className="md:col-span-2" />
          <Input value={listing.moq} onChange={(e) => setListing({ ...listing, moq: e.target.value })} placeholder="MOQ" />
          <Input value={listing.price} onChange={(e) => setListing({ ...listing, price: e.target.value })} placeholder="Price" />
          <Input value={listing.currency} onChange={(e) => setListing({ ...listing, currency: e.target.value })} placeholder="Currency" />
          <Input value={listing.lead_time_days} onChange={(e) => setListing({ ...listing, lead_time_days: e.target.value })} placeholder="Lead Time (days)" />
          <Input value={listing.mediaCsv} onChange={(e) => setListing({ ...listing, mediaCsv: e.target.value })} placeholder="Media URLs (comma-separated)" className="md:col-span-2" />
          <Input value={listing.complianceDocsCsv} onChange={(e) => setListing({ ...listing, complianceDocsCsv: e.target.value })} placeholder="Compliance docs URLs (comma-separated)" className="md:col-span-2" />
          <Input value={listing.company_name} onChange={(e) => setListing({ ...listing, company_name: e.target.value })} placeholder="Company Name" />
          <Input value={listing.contact_name} onChange={(e) => setListing({ ...listing, contact_name: e.target.value })} placeholder="Contact Name" />
          <Input value={listing.country} onChange={(e) => setListing({ ...listing, country: e.target.value })} placeholder="Country" />
          <Input value={listing.email} onChange={(e) => setListing({ ...listing, email: e.target.value })} placeholder="Email" />
          <Input value={listing.phone} onChange={(e) => setListing({ ...listing, phone: e.target.value })} placeholder="Phone" />
          <div className="md:col-span-2">
            <Button onClick={() => void publish()} disabled={publishing || chosenTargets.length === 0}>
              {publishing ? 'Publishing...' : 'Create Draft Jobs'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Publish Jobs Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Request ID: {result.request_id}</p>
            {result.jobs.map((job) => (
              <div key={job.id} className="rounded border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{job.marketplace_code}</p>
                  {statusBadge(job.status)}
                </div>
                {job.error_message && <p className="text-sm text-red-300">{job.error_message}</p>}
                {job.external_listing_url && (
                  <a href={job.external_listing_url} target="_blank" className="text-sm text-blue-400 underline" rel="noreferrer">
                    External Listing
                  </a>
                )}
                <div className="space-y-1">
                  {job.timeline?.map((event, idx) => (
                    <p key={`${job.id}-${idx}`} className="text-xs text-muted-foreground">
                      {new Date(event.at).toLocaleString()} - {event.phase} - {event.status} - {event.message}
                    </p>
                  ))}
                </div>
                {(job.status === 'failed' || job.status === 'manual_action_required' || job.status === 'partner_onboarding_required') && (
                  <Button variant="outline" onClick={() => void retryJob(job.id)}>Retry</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
