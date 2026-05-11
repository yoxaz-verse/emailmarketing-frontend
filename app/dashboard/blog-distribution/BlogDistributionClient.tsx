'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Blog = {
  id: string;
  title: string;
  body: string;
  source_type: 'internal' | 'url' | 'rss';
  source_url: string | null;
  created_at: string;
};

type Connector = { code: 'meta' | 'linkedin' | 'reddit' | 'telegram' | 'whatsapp'; name: string };

const defaultCreate = {
  title: '',
  body: '',
};

const defaultImport = {
  source_type: 'url' as 'url' | 'rss',
  source_url: '',
};

export default function BlogDistributionClient() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlogId, setSelectedBlogId] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Record<string, boolean>>({});
  const [createForm, setCreateForm] = useState(defaultCreate);
  const [importForm, setImportForm] = useState(defaultImport);
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [blogRows, connectorRows] = await Promise.all([
        clientFetch<Blog[]>('/blogs'),
        clientFetch<Connector[]>('/social/connectors'),
      ]);
      setBlogs(blogRows);
      setConnectors(connectorRows);
      const defaults: Record<string, boolean> = {};
      for (const row of connectorRows) defaults[row.code] = true;
      setSelectedChannels(defaults);
      setSelectedBlogId((prev) => prev ?? blogRows[0]?.id ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedBlog = useMemo(
    () => blogs.find((b) => b.id === selectedBlogId) ?? null,
    [blogs, selectedBlogId]
  );

  const channels = useMemo(
    () => connectors.filter((c) => selectedChannels[c.code]).map((c) => c.code),
    [connectors, selectedChannels]
  );

  const createInternal = async () => {
    try {
      setError(null);
      await clientFetch('/blogs', {
        method: 'POST',
        body: JSON.stringify({
          title: createForm.title,
          body: createForm.body,
          source_type: 'internal',
        }),
      });
      setCreateForm(defaultCreate);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const importExternal = async () => {
    try {
      setError(null);
      await clientFetch('/blogs/import', {
        method: 'POST',
        body: JSON.stringify(importForm),
      });
      setImportForm(defaultImport);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const toUtc = (local: string): string | null => {
    if (!local) return null;
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const distribute = async () => {
    if (!selectedBlogId) return;
    try {
      setError(null);
      const data = await clientFetch(`/blogs/${selectedBlogId}/distribute`, {
        method: 'POST',
        body: JSON.stringify({
          channels,
          scheduled_at: toUtc(scheduledLocal),
          timezone: 'Asia/Kolkata',
        }),
      });
      setLastResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Distribution failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Blog Distribution</h2>
        <p className="text-sm text-muted-foreground">Import or create blogs, then fan out to Meta, LinkedIn, Reddit, Telegram, and WhatsApp.</p>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Create Internal Blog</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} placeholder="Blog title" />
          <Textarea value={createForm.body} onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })} placeholder="Blog body" />
          <Button onClick={() => void createInternal()}>Add Internal Blog</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Blog (URL/RSS)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={importForm.source_type}
            onChange={(e) => setImportForm({ ...importForm, source_type: e.target.value as 'url' | 'rss' })}
          >
            <option value="url">URL</option>
            <option value="rss">RSS</option>
          </select>
          <Input value={importForm.source_url} onChange={(e) => setImportForm({ ...importForm, source_url: e.target.value })} placeholder="https://..." />
          <div className="md:col-span-2">
            <Button onClick={() => void importExternal()}>Import Blog</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Blog + Distribute</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading blogs...</p>}
          {!loading && blogs.length === 0 && <p className="text-sm text-muted-foreground">No blogs yet. Add or import one first.</p>}
          {!loading && blogs.length > 0 && (
            <div className="space-y-2">
              {blogs.map((blog) => (
                <label key={blog.id} className="flex items-center justify-between rounded border p-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="blog"
                      checked={selectedBlogId === blog.id}
                      onChange={() => setSelectedBlogId(blog.id)}
                    />
                    <div>
                      <p className="font-medium">{blog.title}</p>
                      <p className="text-xs text-muted-foreground">{blog.source_type} {blog.source_url ? `- ${blog.source_url}` : ''}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{new Date(blog.created_at).toLocaleDateString()}</Badge>
                </label>
              ))}
            </div>
          )}

          {selectedBlog && (
            <div className="rounded border p-3">
              <p className="font-medium">Preview: {selectedBlog.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{selectedBlog.body.slice(0, 220)}...</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Channels</p>
            <div className="grid gap-2 md:grid-cols-2">
              {connectors.map((c) => (
                <label key={c.code} className="flex items-center gap-2 rounded border p-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedChannels[c.code])}
                    onChange={(e) => setSelectedChannels((prev) => ({ ...prev, [c.code]: e.target.checked }))}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Input type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} placeholder="Schedule (IST)" />
          <Button onClick={() => void distribute()} disabled={!selectedBlogId || channels.length === 0}>Distribute Blog</Button>
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle>Distribution Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(lastResult, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
