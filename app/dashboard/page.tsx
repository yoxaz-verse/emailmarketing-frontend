"use client";

import { useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

type OverviewData = {
  inboxes: { status?: 'active' | 'paused' | 'disabled' | string }[];
  daily: unknown[];
};

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    clientFetch<OverviewData>('/stats/overview')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setLoadError(err?.message ?? 'Failed to load stats');
      });

    return () => {
      active = false;
    };
  }, []);

  const inboxes = useMemo(() => data?.inboxes ?? [], [data]);
  const activeInboxes = inboxes.filter((i) => i.status === 'active').length;
  const inactiveInboxes = useMemo(
    () => inboxes.filter((i) => i.status !== 'active').length,
    [inboxes]
  );
  const estimatedDailyVolume = useMemo(
    () => activeInboxes * 250,
    [activeInboxes]
  );
  const activeCampaigns = 12;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">Welcome back. Here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/leads">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Users className="mr-2 h-4 w-4" /> Import Leads
            </Button>
          </Link>
          <Link href="/dashboard/campaign">
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" /> New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-blue-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <Mail className="h-4 w-4 text-blue-500" /> Active Inboxes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {data ? activeInboxes : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data ? `out of ${inboxes.length} total` : 'Loading inbox stats…'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-emerald-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Inbox Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{data ? `${Math.max(0, 100 - inactiveInboxes * 8)}%` : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data ? `${inactiveInboxes} inboxes need attention` : 'Checking sending readiness…'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-green-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <TrendingUp className="h-4 w-4 text-green-500" /> Daily Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{data ? estimatedDailyVolume.toLocaleString() : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data ? 'Estimated emails/day across active inboxes' : 'Calculating capacity…'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-yellow-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <Clock className="h-4 w-4 text-yellow-500" /> Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground mt-1">Cold email campaigns in progress</p>
          </CardContent>
        </Card>
      </div>

      {loadError && (
        <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
          Overview stats failed to load: {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border shadow-sm bg-card">
          <CardHeader>
            <div>
              <CardTitle>Cold Email Focus</CardTitle>
              <CardDescription>Priority checklist for reliable outbound delivery.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                'Warm up new inboxes before scaling volume.',
                'Review bounce trends and pause risky lead segments.',
                'Rotate sending across active inboxes to avoid rate limits.',
                'Prioritize campaigns with lower reply rates for copy refresh.',
                'Keep domain and SMTP health green before launching new sends.'
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader>
              <CardTitle>Email Automation Status</CardTitle>
              <CardDescription>Current system readiness for cold outreach.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Active inboxes</span>
                <span className="text-sm font-semibold text-foreground">{data ? activeInboxes : '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Estimated daily capacity</span>
                <span className="text-sm font-semibold text-foreground">{data ? estimatedDailyVolume.toLocaleString() : '—'}</span>
              </div>
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-300" />
                  <p className="text-sm font-medium text-foreground">Delivery Watch</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Keep an eye on inboxes nearing daily limits.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
