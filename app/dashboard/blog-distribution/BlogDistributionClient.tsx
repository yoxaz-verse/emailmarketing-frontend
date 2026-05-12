'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { clientFetch } from '@/lib/client-fetch';

type BlogStatus = 'ingested' | 'drafted' | 'pending_review' | 'approved' | 'scheduled' | 'published' | 'rejected';
type SocialChannel = 'meta' | 'linkedin' | 'reddit' | 'telegram' | 'whatsapp';

type Blog = {
  id: string;
  title: string;
  body: string;
  status: BlogStatus;
  source_type: 'internal' | 'url' | 'rss';
  source_url: string | null;
  generated_content?: { excerpt?: string; body?: string; hashtags?: string[] } | null;
  source_snapshot?: { publisher_name?: string } | null;
  community_ids?: string[];
  created_at: string;
};

type BlogSource = {
  id: string;
  provider_type: 'rss' | 'api';
  publisher_name: string;
  source_name: string;
  feed_url: string;
};

type PlatformConnector = {
  code: 'medium';
  name: string;
  status: 'manual_assisted';
  deep_link_url: string | null;
  can_schedule: boolean;
  can_publish: boolean;
  credentials_active: boolean;
};

type PlatformPublishJob = {
  id: string;
  request_id: string;
  platform_code: string;
  status: string;
  phase: string;
  scheduled_at: string | null;
  manual_task?: { deep_link_url?: string; instruction?: string } | null;
  timeline?: Array<{ at: string; phase: string; status: string; message: string }>;
  attempts: number;
  created_at: string;
};

const SOCIAL_CONNECTORS: Array<{ code: SocialChannel; name: string }> = [
  { code: 'meta', name: 'Meta' },
  { code: 'linkedin', name: 'LinkedIn' },
  { code: 'reddit', name: 'Reddit' },
  { code: 'telegram', name: 'Telegram' },
  { code: 'whatsapp', name: 'WhatsApp' },
];

const PIPELINE: BlogStatus[] = ['drafted', 'pending_review', 'approved', 'scheduled', 'published', 'rejected'];

function parseCsv(input: string): string[] {
  return Array.from(new Set(input.split(',').map((v) => v.trim()).filter(Boolean)));
}

function statusBadge(status: string) {
  if (status === 'approved') return <Badge className="bg-green-600">Approved</Badge>;
  if (status === 'scheduled') return <Badge className="bg-amber-600">Scheduled</Badge>;
  if (status === 'published') return <Badge className="bg-blue-600">Published</Badge>;
  if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
  if (status === 'pending_review') return <Badge variant="secondary">Pending</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function BlogDistributionClient() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [sources, setSources] = useState<BlogSource[]>([]);
  const [platforms, setPlatforms] = useState<PlatformConnector[]>([]);
  const [jobs, setJobs] = useState<PlatformPublishJob[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({ title: '', body: '', community_csv: '' });
  const [sourceForm, setSourceForm] = useState({ publisher_name: '', source_name: '', feed_url: '', region: '', categories_csv: '' });
  const [approveCommunityCsv, setApproveCommunityCsv] = useState('');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [selectedSocial, setSelectedSocial] = useState<Record<SocialChannel, boolean>>({
    meta: true,
    linkedin: true,
    reddit: false,
    telegram: true,
    whatsapp: true,
  });

  const selectedBlog = useMemo(() => blogs.find((b) => b.id === selectedBlogId) ?? null, [blogs, selectedBlogId]);

  const grouped = useMemo(() => {
    const bucket: Record<BlogStatus, Blog[]> = {
      drafted: [],
      ingested: [],
      pending_review: [],
      approved: [],
      scheduled: [],
      published: [],
      rejected: [],
    };
    for (const blog of blogs) bucket[blog.status]?.push(blog);
    bucket.drafted = [...bucket.drafted, ...bucket.ingested];
    return bucket;
  }, [blogs]);

  const selectedSocialChannels = useMemo(
    () => SOCIAL_CONNECTORS.filter((c) => selectedSocial[c.code]).map((c) => c.code),
    [selectedSocial]
  );

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [blogsData, sourcesData, connectorsData] = await Promise.all([
        clientFetch<Blog[]>('/blogs'),
        clientFetch<BlogSource[]>('/blogs/sources'),
        clientFetch<PlatformConnector[]>('/blogs/platform-connectors'),
      ]);
      setBlogs(blogsData || []);
      setSources(sourcesData || []);
      setPlatforms(connectorsData || []);
      if (!selectedBlogId && blogsData.length > 0) setSelectedBlogId(blogsData[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load blog distribution data');
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async (blogId: string) => {
    try {
      const data = await clientFetch<PlatformPublishJob[]>(`/blogs/${blogId}/publish-jobs`);
      setJobs(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load publish jobs');
    }
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedBlogId) void loadJobs(selectedBlogId);
  }, [selectedBlogId]);

  const createSource = async () => {
    try {
      setError(null);
      await clientFetch('/blogs/sources', {
        method: 'POST',
        body: JSON.stringify({
          provider_type: 'rss',
          publisher_name: sourceForm.publisher_name.trim(),
          source_name: sourceForm.source_name.trim(),
          feed_url: sourceForm.feed_url.trim(),
          region: sourceForm.region.trim() || null,
          categories: parseCsv(sourceForm.categories_csv),
          trust_score: 0.7,
          polling_interval_minutes: 60,
          active: true,
        }),
      });
      setSourceForm({ publisher_name: '', source_name: '', feed_url: '', region: '', categories_csv: '' });
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create source');
    }
  };

  const runIngestion = async () => {
    try {
      setError(null);
      await clientFetch('/blogs/ingest/run', { method: 'POST' });
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run ingestion');
    }
  };

  const createBlog = async () => {
    try {
      setError(null);
      const title = createForm.title.trim();
      const body = createForm.body.trim();
      if (!title || !body) {
        setError('Title and body are required');
        return;
      }
      const created = await clientFetch<Blog>('/blogs', {
        method: 'POST',
        body: JSON.stringify({ title, body, source_type: 'internal', community_ids: parseCsv(createForm.community_csv) }),
      });
      setCreateForm({ title: '', body: '', community_csv: '' });
      setSelectedBlogId(created.id);
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create blog');
    }
  };

  const approveBlog = async (blogId: string) => {
    try {
      setError(null);
      await clientFetch(`/blogs/${blogId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ community_ids: parseCsv(approveCommunityCsv) }),
      });
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve blog');
    }
  };

  const rejectBlog = async (blogId: string) => {
    try {
      setError(null);
      await clientFetch(`/blogs/${blogId}/reject`, { method: 'POST', body: JSON.stringify({ notes: 'Rejected from pipeline' }) });
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject blog');
    }
  };

  const scheduleUnified = async () => {
    if (!selectedBlog) return;
    try {
      setError(null);
      if (selectedBlog.status !== 'approved') {
        setError('Only approved blogs can enter Medium + social scheduler.');
        return;
      }
      const scheduled = scheduledLocal ? new Date(scheduledLocal).toISOString() : null;
      await clientFetch(`/blogs/${selectedBlog.id}/platform-publish-jobs`, {
        method: 'POST',
        body: JSON.stringify({
          targets: ['medium'],
          scheduled_at: scheduled,
          timezone: 'Asia/Kolkata',
          social_channels: selectedSocialChannels,
          cta_url: ctaUrl.trim() || undefined,
        }),
      });
      await refreshAll();
      await loadJobs(selectedBlog.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule blog publishing');
    }
  };

  const retryJob = async (jobId: string) => {
    try {
      setError(null);
      await clientFetch(`/blogs/publish-jobs/${jobId}/retry`, { method: 'POST', body: JSON.stringify({}) });
      if (selectedBlogId) await loadJobs(selectedBlogId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retry job');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Blog Distribution v2</h2>
          <p className="text-sm text-muted-foreground">Pipeline-first blog operations with unified Medium publishing + social scheduling.</p>
        </div>
        <Button variant="outline" onClick={() => void refreshAll()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Source Registry + Ingestion</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input value={sourceForm.publisher_name} onChange={(e) => setSourceForm({ ...sourceForm, publisher_name: e.target.value })} placeholder="Publisher name" />
          <Input value={sourceForm.source_name} onChange={(e) => setSourceForm({ ...sourceForm, source_name: e.target.value })} placeholder="Source name" />
          <Input value={sourceForm.feed_url} onChange={(e) => setSourceForm({ ...sourceForm, feed_url: e.target.value })} placeholder="RSS feed URL" className="md:col-span-2" />
          <Input value={sourceForm.region} onChange={(e) => setSourceForm({ ...sourceForm, region: e.target.value })} placeholder="Region" />
          <Input value={sourceForm.categories_csv} onChange={(e) => setSourceForm({ ...sourceForm, categories_csv: e.target.value })} placeholder="Categories/community ids CSV" />
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={() => void createSource()}>Add Source</Button>
            <Button variant="outline" onClick={() => void runIngestion()}>Run Ingestion</Button>
          </div>
          <div className="md:col-span-2 text-xs text-muted-foreground">Configured sources: {sources.length}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Internal Draft</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} placeholder="Blog title" />
          <Textarea value={createForm.body} onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })} placeholder="Blog body" />
          <Input value={createForm.community_csv} onChange={(e) => setCreateForm({ ...createForm, community_csv: e.target.value })} placeholder="Community IDs CSV" />
          <Button onClick={() => void createBlog()}>Create Draft</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Sections</CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={approveCommunityCsv} onChange={(e) => setApproveCommunityCsv(e.target.value)} placeholder="Community IDs for approvals (CSV)" />
          <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {PIPELINE.map((stage) => (
              <div key={stage} className="rounded border p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase">{stage.replace('_', ' ')}</p>
                  <Badge variant="outline">{grouped[stage]?.length ?? 0}</Badge>
                </div>
                {(grouped[stage] ?? []).slice(0, 6).map((blog) => (
                  <div key={blog.id} className={`rounded border p-2 text-xs ${selectedBlogId === blog.id ? 'border-blue-500' : ''}`}>
                    <button className="text-left w-full" onClick={() => setSelectedBlogId(blog.id)}>
                      <p className="font-medium truncate">{blog.title}</p>
                      <p className="text-muted-foreground truncate">{blog.source_snapshot?.publisher_name || blog.source_type}</p>
                    </button>
                    {stage === 'pending_review' && (
                      <div className="mt-2 flex gap-1">
                        <Button size="sm" className="h-6 px-2" onClick={() => void approveBlog(blog.id)}>Approve</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => void rejectBlog(blog.id)}>Reject</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unified Medium + Social Scheduler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedBlog && <p className="text-sm text-muted-foreground">Select a blog from pipeline sections.</p>}
          {selectedBlog && (
            <>
              <div className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{selectedBlog.title}</p>
                  {statusBadge(selectedBlog.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{selectedBlog.source_url || 'Internal source'}</p>
                <p className="text-sm text-muted-foreground mt-2">{selectedBlog.generated_content?.excerpt || selectedBlog.body.slice(0, 200)}</p>
              </div>

              <div className="text-sm">Blog destination</div>
              <div className="grid gap-2 md:grid-cols-2">
                {(platforms.length === 0 ? [{ code: 'medium', name: 'Medium', status: 'manual_assisted', deep_link_url: 'https://medium.com/new-story', can_schedule: true, can_publish: true, credentials_active: true }] : platforms).map((p) => (
                  <div key={p.code} className="rounded border p-2 text-sm">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.status}</p>
                  </div>
                ))}
              </div>

              <div className="text-sm">Social fan-out channels</div>
              <div className="grid gap-2 md:grid-cols-3">
                {SOCIAL_CONNECTORS.map((c) => (
                  <label key={c.code} className="flex items-center gap-2 rounded border p-2 text-sm">
                    <input checked={selectedSocial[c.code]} onChange={(e) => setSelectedSocial((prev) => ({ ...prev, [c.code]: e.target.checked }))} type="checkbox" />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>

              <Input type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} placeholder="Schedule in local timezone" />
              <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="CTA URL (optional)" />
              <Button onClick={() => void scheduleUnified()}>Schedule To Medium + Social</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medium Publish Jobs Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">No platform publish jobs yet for selected blog.</p>}
          {jobs.map((job) => (
            <div key={job.id} className="rounded border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">{job.platform_code}</p>
                <Badge variant="outline">{job.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Phase: {job.phase} | Attempts: {job.attempts}</p>
              {job.manual_task?.deep_link_url && (
                <a className="text-xs underline text-blue-300" href={job.manual_task.deep_link_url} target="_blank" rel="noreferrer">Open Medium Publish Link</a>
              )}
              <div className="space-y-1">
                {(job.timeline ?? []).slice(-4).map((event, idx) => (
                  <p key={`${job.id}-${idx}`} className="text-xs text-muted-foreground">{new Date(event.at).toLocaleString()} - {event.phase} - {event.status} - {event.message}</p>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => void retryJob(job.id)}>Retry</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
