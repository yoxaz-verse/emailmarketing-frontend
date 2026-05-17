'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type Inquiry = {
  id: string;
  inquiry_code: string;
  source_code: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  product_interest: string | null;
};

type Quote = {
  id: string;
  quote_code: string;
  inquiry_id: string;
  price: number | null;
  quantity: string | null;
  currency: string | null;
  incoterm: string | null;
  validity_date: string | null;
  terms: string | null;
  status: 'draft' | 'reviewed' | 'approved' | 'sent' | 'closed';
  manual_sent_at: string | null;
  sent_channel: string | null;
  owner: string | null;
  notes: string | null;
  inquiry?: {
    inquiry_code: string;
    source_code: string | null;
    buyer_name: string | null;
    buyer_email: string | null;
    product_interest: string | null;
  } | null;
  created_at: string;
};

const STATUSES = ['draft', 'reviewed', 'approved', 'sent', 'closed'] as const;

export default function InquiryQuotingClient() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');

  const [draft, setDraft] = useState({
    inquiry_id: '',
    price: '',
    quantity: '',
    currency: 'USD',
    incoterm: 'CIF',
    validity_date: '',
    terms: '',
    owner: '',
    notes: '',
  });

  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, Partial<Quote> & { mark_sent?: boolean }>>({});

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      if (statusFilter && q.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const term = query.trim().toLowerCase();
      const blob = [q.quote_code, q.inquiry?.inquiry_code, q.inquiry?.buyer_name, q.inquiry?.buyer_email, q.notes]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      return blob.includes(term);
    });
  }, [quotes, statusFilter, query]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inquiryData, quoteData] = await Promise.all([
        clientFetch<{ rows: Inquiry[] }>('/inquiries?page=1&page_size=300'),
        clientFetch<{ rows: Quote[] }>('/quotes?page=1&page_size=300'),
      ]);
      setInquiries(inquiryData.rows ?? []);
      setQuotes(quoteData.rows ?? []);
      setDraft((prev) => ({
        ...prev,
        inquiry_id: prev.inquiry_id || (inquiryData.rows?.[0]?.id ?? ''),
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inquiry quoting data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createQuote() {
    setError(null);
    setSuccess(null);
    try {
      if (!draft.inquiry_id) throw new Error('Select an inquiry first');
      const payload = {
        inquiry_id: draft.inquiry_id,
        price: draft.price ? Number(draft.price) : null,
        quantity: draft.quantity || null,
        currency: draft.currency || 'USD',
        incoterm: draft.incoterm || null,
        validity_date: draft.validity_date || null,
        terms: draft.terms || null,
        owner: draft.owner || null,
        notes: draft.notes || null,
      };
      await clientFetch('/quotes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess('Quote draft created successfully.');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create quote draft');
    }
  }

  function patchQuoteDraft(id: string, field: keyof Quote | 'mark_sent', value: string | boolean) {
    setQuoteDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  async function saveQuote(quote: Quote) {
    setError(null);
    setSuccess(null);
    try {
      const patch = quoteDrafts[quote.id] ?? {};
      if (Object.keys(patch).length === 0) {
        setSuccess(`No changes for ${quote.quote_code}`);
        return;
      }
      await clientFetch(`/quotes/${quote.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });

      setSuccess(`Quote updated: ${quote.quote_code}`);
      setQuoteDrafts((prev) => {
        const next = { ...prev };
        delete next[quote.id];
        return next;
      });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update quote');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Inquiry Quoting</h2>
        <p className="text-sm text-muted-foreground">Create and track quote drafts linked to inquiries, then mark manual sent status with audit trail.</p>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {success && <div className="rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">{success}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Create Quote Draft</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={draft.inquiry_id} onChange={(e) => setDraft((prev) => ({ ...prev, inquiry_id: e.target.value }))}>
            <option value="">Select Inquiry</option>
            {inquiries.map((inq) => (
              <option key={inq.id} value={inq.id}>{inq.inquiry_code} - {inq.buyer_name ?? 'Unknown'}</option>
            ))}
          </select>
          <Input placeholder="Price" value={draft.price} onChange={(e) => setDraft((prev) => ({ ...prev, price: e.target.value }))} />
          <Input placeholder="Quantity" value={draft.quantity} onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))} />
          <Input placeholder="Currency" value={draft.currency} onChange={(e) => setDraft((prev) => ({ ...prev, currency: e.target.value }))} />
          <Input placeholder="Incoterm" value={draft.incoterm} onChange={(e) => setDraft((prev) => ({ ...prev, incoterm: e.target.value }))} />
          <Input type="date" placeholder="Validity Date" value={draft.validity_date} onChange={(e) => setDraft((prev) => ({ ...prev, validity_date: e.target.value }))} />
          <Input placeholder="Owner" value={draft.owner} onChange={(e) => setDraft((prev) => ({ ...prev, owner: e.target.value }))} />
          <Textarea className="md:col-span-2" placeholder="Commercial terms" value={draft.terms} onChange={(e) => setDraft((prev) => ({ ...prev, terms: e.target.value }))} />
          <Textarea className="md:col-span-3" placeholder="Notes" value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} />
          <div className="md:col-span-3">
            <Button onClick={() => void createQuote()} disabled={loading}>Create Draft</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quote Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Search quote/buyer" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <Button variant="outline" onClick={() => void loadData()}>Refresh</Button>
          </div>

          {filteredQuotes.length === 0 && <div className="text-sm text-muted-foreground">No quotes found.</div>}

          {filteredQuotes.map((quote) => {
            const patch = quoteDrafts[quote.id] ?? {};
            return (
              <div key={quote.id} className="rounded border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{quote.quote_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {quote.inquiry?.inquiry_code ?? 'N/A'} | {quote.inquiry?.buyer_name ?? 'Unknown buyer'} | {quote.inquiry?.buyer_email ?? 'No email'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{quote.status}</Badge>
                    {quote.manual_sent_at && <Badge className="bg-emerald-700">sent</Badge>}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-4">
                  <Input placeholder="Price" value={String(patch.price ?? quote.price ?? '')} onChange={(e) => patchQuoteDraft(quote.id, 'price', e.target.value ? Number(e.target.value) : '')} />
                  <Input placeholder="Quantity" value={String(patch.quantity ?? quote.quantity ?? '')} onChange={(e) => patchQuoteDraft(quote.id, 'quantity', e.target.value)} />
                  <Input placeholder="Currency" value={String(patch.currency ?? quote.currency ?? '')} onChange={(e) => patchQuoteDraft(quote.id, 'currency', e.target.value)} />
                  <Input placeholder="Incoterm" value={String(patch.incoterm ?? quote.incoterm ?? '')} onChange={(e) => patchQuoteDraft(quote.id, 'incoterm', e.target.value)} />
                  <Input type="date" placeholder="Validity" value={String(patch.validity_date ?? quote.validity_date ?? '')} onChange={(e) => patchQuoteDraft(quote.id, 'validity_date', e.target.value)} />
                  <Input placeholder="Owner" value={String(patch.owner ?? quote.owner ?? '')} onChange={(e) => patchQuoteDraft(quote.id, 'owner', e.target.value)} />
                  <Input placeholder="Sent Channel" value={String(patch.sent_channel ?? quote.sent_channel ?? '')} onChange={(e) => patchQuoteDraft(quote.id, 'sent_channel', e.target.value)} />
                  <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={String(patch.status ?? quote.status)} onChange={(e) => patchQuoteDraft(quote.id, 'status', e.target.value)}>
                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <Textarea className="md:col-span-2" placeholder="Terms" value={String(patch.terms ?? quote.terms ?? '')} onChange={(e) => patchQuoteDraft(quote.id, 'terms', e.target.value)} />
                  <Textarea className="md:col-span-2" placeholder="Notes" value={String(patch.notes ?? quote.notes ?? '')} onChange={(e) => patchQuoteDraft(quote.id, 'notes', e.target.value)} />
                </div>

                <label className="text-xs flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(patch.mark_sent ?? false)}
                    onChange={(e) => patchQuoteDraft(quote.id, 'mark_sent', e.target.checked)}
                  />
                  Mark manually sent
                </label>

                <Button onClick={() => void saveQuote(quote)}>Save Quote</Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
