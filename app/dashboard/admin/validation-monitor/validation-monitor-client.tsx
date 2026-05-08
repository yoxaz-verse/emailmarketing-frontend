'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  getValidationMonitorAction,
  resetStuckAndRerunValidationMonitorAction,
  rerunFailedValidationMonitorAction,
  type ValidationMonitorPayload,
} from './actions';

const REASON_GUIDE: Record<string, { meaning: string; nextStep: string }> = {
  invalid_syntax: {
    meaning: 'Email format is invalid.',
    nextStep: 'Clean source data and re-import corrected leads.',
  },
  no_mx: {
    meaning: 'Domain has no MX records.',
    nextStep: 'Treat as invalid or verify domain correctness before retrying.',
  },
  free_provider: {
    meaning: 'Free mailbox provider detected.',
    nextStep: 'Decide whether to exclude or keep as risky.',
  },
  role_based: {
    meaning: 'Role-based mailbox detected (e.g., info@, support@).',
    nextStep: 'Review if your campaign policy allows role-based addresses.',
  },
  disposable_domain: {
    meaning: 'Disposable email domain detected.',
    nextStep: 'Block disposable domains for campaign quality.',
  },
  dns_timeout_retryable: {
    meaning: 'Domain check timed out while validating.',
    nextStep: 'Retry failed leads once network/DNS stabilizes.',
  },
};

function fmtDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

export default function ValidationMonitorClient({
  initialData,
  loadError,
}: {
  initialData: ValidationMonitorPayload | null;
  loadError?: string;
}) {
  const [data, setData] = useState<ValidationMonitorPayload | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(loadError);

  const hasActiveRun = data?.run?.status === 'running' || data?.run?.status === 'queued';

  async function refresh() {
    setLoading(true);
    try {
      const next = await getValidationMonitorAction();
      setData(next);
      setError(undefined);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to refresh monitor');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      void refresh();
    }, hasActiveRun ? 5000 : 10000);
    return () => clearInterval(interval);
  }, [hasActiveRun]);

  const dominantReason = useMemo(() => data?.reasons?.topReasons?.[0]?.reason ?? null, [data?.reasons?.topReasons]);
  const dominantGuide = dominantReason ? REASON_GUIDE[dominantReason] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Validation Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simple run telemetry with step-wise failure visibility.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard label="Run Status" value={data?.run?.status ?? 'idle'} />
        <MetricCard label="Run Age" value={fmtDuration(data?.metrics?.runAgeSeconds ?? 0)} />
        <MetricCard label="Targeted / Processed" value={`${data?.run?.total_targeted ?? 0} / ${data?.run?.processed_count ?? 0}`} />
        <MetricCard label="Remaining" value={(data?.run?.total_targeted ?? 0) - (data?.run?.processed_count ?? 0)} />
        <MetricCard label="Pending Available" value={data?.metrics?.pendingAvailable ?? 0} />
        <MetricCard label="Processing Now" value={data?.metrics?.processingNow ?? 0} />
        <MetricCard label="Recent Updates (2m)" value={data?.metrics?.recentUpdates ?? 0} />
        <MetricCard label="Total Leads" value={data?.metrics?.totalLeads ?? 0} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-medium">Execution Mode</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>Mode: <span className="font-medium">Inline one-by-one</span></div>
          <div>Flow: <span className="font-medium">Basic step validation</span></div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-medium">Step Failure Summary</h2>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Step 1 (Syntax): <span className="font-medium text-foreground">{data?.reasons?.stepFailureCounts?.step_1_syntax ?? 0}</span></li>
          <li>Step 2 (Provider/Domain): <span className="font-medium text-foreground">{data?.reasons?.stepFailureCounts?.step_2_provider ?? 0}</span></li>
          <li>Step 3 (Risk Filters): <span className="font-medium text-foreground">{data?.reasons?.stepFailureCounts?.step_3_risk ?? 0}</span></li>
          <li>Step 4 (Finalize): <span className="font-medium text-foreground">{data?.reasons?.stepFailureCounts?.step_4_finalize ?? 0}</span></li>
        </ul>
        {data?.reasons?.mostFailedStep && data.reasons.mostFailedStep.count > 0 ? (
          <div className="text-sm text-amber-300">
            Most failures at: <span className="font-medium">{data.reasons.mostFailedStep.label}</span> ({data.reasons.mostFailedStep.count})
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-lg font-medium">Top Reasons</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3">Reason</th>
                <th className="py-2 pr-3">Count</th>
                <th className="py-2 pr-3">Meaning</th>
                <th className="py-2 pr-3">Next Step</th>
              </tr>
            </thead>
            <tbody>
              {(data?.reasons?.topReasons ?? []).map((row) => {
                const guide = REASON_GUIDE[row.reason];
                return (
                  <tr key={row.reason} className="border-b border-border">
                    <td className="py-2 pr-3 font-mono">{row.reason}</td>
                    <td className="py-2 pr-3">{row.count}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{guide?.meaning ?? 'No description yet.'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{guide?.nextStep ?? 'Review lead-level results.'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-medium">Diagnosis</h2>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          {(data?.diagnosis ?? []).map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>

      {dominantGuide ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <div className="font-medium">Dominant reason: {dominantReason}</div>
          <div className="text-muted-foreground mt-1">{dominantGuide.meaning}</div>
          <div className="mt-2">Recommended next step: <span className="font-medium">{dominantGuide.nextStep}</span></div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="px-4 py-2 rounded border border-border hover:bg-muted text-sm"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Reset in-progress rows and re-run pending validation?')) return;
            try {
              const result = await resetStuckAndRerunValidationMonitorAction();
              toast.success(`Reset + re-run started (${result.queued} queued)`);
              await refresh();
            } catch (err: any) {
              toast.error(err?.message ?? 'Failed to reset and re-run');
            }
          }}
          className="px-4 py-2 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-sm"
        >
          Reset In-Progress & Re-run
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Re-run failed validation leads now?')) return;
            try {
              const result = await rerunFailedValidationMonitorAction();
              toast.success(`Re-run failed started (${result.queued} queued)`);
              await refresh();
            } catch (err: any) {
              toast.error(err?.message ?? 'Failed to re-run failed leads');
            }
          }}
          className="px-4 py-2 rounded border border-border hover:bg-muted text-sm"
        >
          Re-run Failed
        </button>
      </div>
    </div>
  );
}
