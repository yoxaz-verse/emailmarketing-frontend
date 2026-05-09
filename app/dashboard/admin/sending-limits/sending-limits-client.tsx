'use client';

import { useState } from 'react';
import { updateSendingLimits } from './actions';

type WarmupStep = {
  day: number;
  daily_limit: number;
  hourly_limit: number;
};

type SendingLimitsConfig = {
  min_inbox_health_score: number;
  min_domain_health_score: number;
  warmup_advance_min_health_score: number;
  warmup_advance_max_consecutive_failures: number;
  risky_daily_percent_limit: number;
  warmup_steps: WarmupStep[];
};

function normalizeSteps(steps: WarmupStep[]): WarmupStep[] {
  return [...steps]
    .map((s) => ({
      day: Number(s.day),
      daily_limit: Number(s.daily_limit),
      hourly_limit: Number(s.hourly_limit),
    }))
    .sort((a, b) => a.day - b.day);
}

export default function SendingLimitsClient({
  initialConfig,
  loadError,
}: {
  initialConfig: SendingLimitsConfig;
  loadError?: string;
}) {
  const [config, setConfig] = useState<SendingLimitsConfig>({
    ...initialConfig,
    warmup_steps: normalizeSteps(initialConfig.warmup_steps ?? []),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');

  function updateTopLevel(key: keyof SendingLimitsConfig, value: number) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function updateStep(index: number, key: keyof WarmupStep, value: number) {
    setConfig((prev) => {
      const next = [...prev.warmup_steps];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, warmup_steps: normalizeSteps(next) };
    });
  }

  function addStep() {
    setConfig((prev) => {
      const lastDay =
        prev.warmup_steps.length > 0 ? prev.warmup_steps[prev.warmup_steps.length - 1].day : 0;
      return {
        ...prev,
        warmup_steps: normalizeSteps([
          ...prev.warmup_steps,
          { day: lastDay + 1, daily_limit: 20, hourly_limit: 5 },
        ]),
      };
    });
  }

  function removeStep(index: number) {
    setConfig((prev) => ({
      ...prev,
      warmup_steps: normalizeSteps(prev.warmup_steps.filter((_, i) => i !== index)),
    }));
  }

  async function save() {
    setSaving(true);
    setMessage('');

    try {
      const payload: SendingLimitsConfig = {
        ...config,
        warmup_steps: normalizeSteps(config.warmup_steps),
      };
      const result = await updateSendingLimits(payload);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to save');
      }
      const updated = result.config as SendingLimitsConfig;
      setConfig({
        ...updated,
        warmup_steps: normalizeSteps(updated.warmup_steps ?? []),
      });
      setMessage('Saved successfully. New limits are active immediately.');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {loadError ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          {loadError}
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sending Limits</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Admin-managed limits used directly in send checks and warmup progression.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-lg font-medium">Global Calculation Parameters</h2>
        <p className="text-xs text-muted-foreground">
          These values are used by backend calculations immediately after save.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm space-y-1">
            <span>Min Inbox Health Score (Pause below)</span>
            <input
              type="number"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.min_inbox_health_score}
              onChange={(e) => updateTopLevel('min_inbox_health_score', Number(e.target.value))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Min Domain Health Score (Pause below)</span>
            <input
              type="number"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.min_domain_health_score}
              onChange={(e) => updateTopLevel('min_domain_health_score', Number(e.target.value))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Warmup Advance Min Health Score</span>
            <input
              type="number"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.warmup_advance_min_health_score}
              onChange={(e) => updateTopLevel('warmup_advance_min_health_score', Number(e.target.value))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Warmup Advance Max Consecutive Failures</span>
            <input
              type="number"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.warmup_advance_max_consecutive_failures}
              onChange={(e) =>
                updateTopLevel('warmup_advance_max_consecutive_failures', Number(e.target.value))
              }
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Risky Daily Percent Limit</span>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.risky_daily_percent_limit}
              onChange={(e) => updateTopLevel('risky_daily_percent_limit', Number(e.target.value))}
            />
            <span className="text-xs text-muted-foreground">
              Per inbox/day cap for risky sends. Example: 10 daily limit + 20% = 2 risky max.
            </span>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Warmup Day Schedule</h2>
          <button
            type="button"
            onClick={addStep}
            className="text-sm px-3 py-1.5 rounded border border-border hover:bg-muted"
          >
            Add Day
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-2 pr-3">Day</th>
                <th className="py-2 pr-3">Daily Limit</th>
                <th className="py-2 pr-3">Hourly Limit</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {config.warmup_steps.map((step, index) => (
                <tr key={`${step.day}-${index}`} className="border-b border-border">
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      className="w-24 border border-border bg-background rounded px-2 py-1"
                      value={step.day}
                      onChange={(e) => updateStep(index, 'day', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      className="w-32 border border-border bg-background rounded px-2 py-1"
                      value={step.daily_limit}
                      onChange={(e) => updateStep(index, 'daily_limit', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      className="w-32 border border-border bg-background rounded px-2 py-1"
                      value={step.hourly_limit}
                      onChange={(e) => updateStep(index, 'hourly_limit', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-red-600 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded"
        >
          {saving ? 'Saving...' : 'Save Limits'}
        </button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
