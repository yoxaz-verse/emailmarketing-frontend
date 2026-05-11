'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Connector = {
  code: 'meta' | 'linkedin' | 'reddit' | 'telegram' | 'whatsapp';
  name: string;
  status: 'manual_assisted';
  auth_type: 'none';
  can_schedule: boolean;
  can_publish: boolean;
  credentials_active: boolean;
  deep_link_url: string | null;
};

type SocialJob = {
  id: string;
  platform_code: string;
  status: string;
  phase: string;
  error_message: string | null;
  manual_task: Record<string, unknown> | null;
  timeline: { at: string; phase: string; status: string; message: string }[];
};

type SocialPublishResponse = {
  request_id: string;
  idempotency_key: string;
  jobs: SocialJob[];
};

const defaultPost = {
  content: 'New update from Obaol. We just published a practical growth playbook for Indian SMBs. Read now.',
  mediaCsv: '',
  cta_url: '',
  hashtagsCsv: '#Marketing,#India,#Growth',
  scheduled_local: '',
};

function statusBadge(status: string) {
  if (status === 'manual_action_required') return <Badge variant="secondary">Manual Assisted</Badge>;
  if (status === 'published') return <Badge className="bg-green-600">Published</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function SocialSchedulingClient() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SocialPublishResponse | null>(null);
  const [post, setPost] = useState(defaultPost);

  const loadConnectors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientFetch<Connector[]>('/social/connectors');
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

  const targets = useMemo(
    () => connectors.filter((c) => selected[c.code]).map((c) => c.code),
    [connectors, selected]
  );

  const scheduleToUtc = (local: string): string | null => {
    if (!local) return null;
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        targets,
        post_input: {
          content: post.content,
          media: post.mediaCsv.split(',').map((x) => x.trim()).filter(Boolean),
          cta_url: post.cta_url || undefined,
          hashtags: post.hashtagsCsv.split(',').map((x) => x.trim()).filter(Boolean),
          timezone: 'Asia/Kolkata',
          scheduled_at: scheduleToUtc(post.scheduled_local),
        },
      };

      const data = await clientFetch<SocialPublishResponse>('/social/publish-jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create jobs');
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async (jobId: string) => {
    try {
      const job = await clientFetch<SocialJob>(`/social/publish-jobs/${jobId}/retry`, { method: 'POST' });
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
        <h2 className="text-2xl font-bold tracking-tight">Social Scheduling</h2>
        <p className="text-sm text-muted-foreground">Queue-first, manual-assisted social publishing for India-first channels.</p>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Platform Picker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading platforms...</p>}
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
              <Badge variant="secondary">Manual Assisted</Badge>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Post Composer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Textarea value={post.content} onChange={(e) => setPost({ ...post, content: e.target.value })} placeholder="Post content" className="md:col-span-2" />
          <Input value={post.cta_url} onChange={(e) => setPost({ ...post, cta_url: e.target.value })} placeholder="CTA URL (optional)" />
          <Input value={post.hashtagsCsv} onChange={(e) => setPost({ ...post, hashtagsCsv: e.target.value })} placeholder="Hashtags comma-separated" />
          <Input value={post.mediaCsv} onChange={(e) => setPost({ ...post, mediaCsv: e.target.value })} placeholder="Media URLs comma-separated" className="md:col-span-2" />
          <Input type="datetime-local" value={post.scheduled_local} onChange={(e) => setPost({ ...post, scheduled_local: e.target.value })} placeholder="Schedule (IST)" />
          <div className="md:col-span-2">
            <Button onClick={() => void submit()} disabled={submitting || targets.length === 0}>
              {submitting ? 'Creating...' : 'Create Scheduled Jobs'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Jobs Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.jobs.map((job) => (
              <div key={job.id} className="rounded border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{job.platform_code}</p>
                  {statusBadge(job.status)}
                </div>
                {job.error_message && <p className="text-sm text-red-300">{job.error_message}</p>}
                <div className="space-y-1">
                  {job.timeline?.map((event, idx) => (
                    <p key={`${job.id}-${idx}`} className="text-xs text-muted-foreground">
                      {new Date(event.at).toLocaleString()} - {event.phase} - {event.status} - {event.message}
                    </p>
                  ))}
                </div>
                {(job.status === 'failed' || job.status === 'manual_action_required') && (
                  <Button variant="outline" onClick={() => void retry(job.id)}>Retry</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
