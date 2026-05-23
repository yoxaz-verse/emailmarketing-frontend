'use client';

import { useState } from 'react';
import { updateSendingLimits } from './actions';
import type {
  SendingLimitsApiWarmupStep,
  SendingLimitsConfig,
  SendingLimitsPayload,
  UiWarmupStep,
} from './types';

function normalizeSteps(steps: Array<Partial<UiWarmupStep>>): UiWarmupStep[] {
  return [...steps].map((s, index) => ({
    id: String(s.id ?? `warmup-step-${Date.now()}-${index}`),
    day: Number(s.day ?? 0),
    daily_limit: Number(s.daily_limit ?? 0),
    hourly_limit: Number(s.hourly_limit ?? 0),
  }));
}

function sortStepsByDay(steps: UiWarmupStep[]): UiWarmupStep[] {
  return [...steps].sort((a, b) => a.day - b.day);
}

function hasPersistedScheduleFields(raw: unknown): raw is {
  schedule_enabled: boolean;
  schedule_timezone: string;
  allowed_weekdays: number[];
  send_window_start: string;
  send_window_end: string;
} {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as Record<string, unknown>;
  return (
    typeof row.schedule_enabled === 'boolean' &&
    typeof row.schedule_timezone === 'string' &&
    Array.isArray(row.allowed_weekdays) &&
    typeof row.send_window_start === 'string' &&
    typeof row.send_window_end === 'string'
  );
}

export default function SendingLimitsClient({
  initialConfig,
  loadError,
}: {
  initialConfig: SendingLimitsConfig;
  loadError?: string;
}) {
  const defaultWeekdays = [0, 1, 2, 3, 4, 5, 6];
  const [config, setConfig] = useState<Omit<SendingLimitsConfig, 'warmup_steps'> & { warmup_steps: UiWarmupStep[] }>({
    ...initialConfig,
    schedule_enabled: initialConfig.schedule_enabled ?? true,
    schedule_timezone: initialConfig.schedule_timezone ?? 'Asia/Kolkata',
    allowed_weekdays: Array.isArray(initialConfig.allowed_weekdays) && initialConfig.allowed_weekdays.length > 0
      ? initialConfig.allowed_weekdays
      : defaultWeekdays,
    send_window_start: initialConfig.send_window_start ?? '00:00',
    send_window_end: initialConfig.send_window_end ?? '23:59',
    warmup_steps: normalizeSteps(initialConfig.warmup_steps ?? []),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const weekdayOptions = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
  ];

  function updateTopLevelNumber(
    key: 'min_inbox_health_score' | 'min_domain_health_score' | 'warmup_advance_min_health_score' | 'warmup_advance_max_consecutive_failures' | 'risky_daily_percent_limit',
    value: number
  ) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function updateStep(stepId: string, key: keyof SendingLimitsApiWarmupStep, value: number) {
    setConfig((prev) => {
      const next = prev.warmup_steps.map((step) =>
        step.id === stepId ? { ...step, [key]: value } : step
      );
      return { ...prev, warmup_steps: next };
    });
  }

  function addStep() {
    setConfig((prev) => {
      const sorted = sortStepsByDay(prev.warmup_steps);
      const lastDay = sorted.length > 0 ? sorted[sorted.length - 1].day : 0;
      return {
        ...prev,
        warmup_steps: normalizeSteps([
          ...prev.warmup_steps,
          {
            id: `warmup-step-${Date.now()}`,
            day: lastDay + 1,
            daily_limit: 20,
            hourly_limit: 5,
          },
        ]),
      };
    });
  }

  function removeStep(stepId: string) {
    setConfig((prev) => ({
      ...prev,
      warmup_steps: prev.warmup_steps.filter((step) => step.id !== stepId),
    }));
  }

  function toggleWeekday(day: number) {
    setConfig((prev) => {
      const currentWeekdays = Array.isArray(prev.allowed_weekdays) ? prev.allowed_weekdays : defaultWeekdays;
      const exists = currentWeekdays.includes(day);
      const next = exists
        ? currentWeekdays.filter((d) => d !== day)
        : [...currentWeekdays, day];
      return { ...prev, allowed_weekdays: next.sort((a, b) => a - b) };
    });
  }

  async function save() {
    setSaving(true);
    setMessage('');

    try {
      const payload: SendingLimitsPayload = {
        ...config,
        warmup_steps: sortStepsByDay(normalizeSteps(config.warmup_steps)).map((step) => ({
          day: step.day,
          daily_limit: step.daily_limit,
          hourly_limit: step.hourly_limit,
        })),
      };
      const result = await updateSendingLimits(payload);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to save');
      }
      const updated = result.config as SendingLimitsConfig;
      if (!hasPersistedScheduleFields(updated)) {
        throw new Error(
          'Backend schema/runtime mismatch: schedule fields not persisted. Apply latest migration and restart backend.'
        );
      }
      setConfig({
        ...updated,
        schedule_enabled: updated.schedule_enabled ?? true,
        schedule_timezone: updated.schedule_timezone ?? 'Asia/Kolkata',
        allowed_weekdays: Array.isArray(updated.allowed_weekdays) && updated.allowed_weekdays.length > 0
          ? updated.allowed_weekdays
          : defaultWeekdays,
        send_window_start: updated.send_window_start ?? '00:00',
        send_window_end: updated.send_window_end ?? '23:59',
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
        <div className="mt-3 rounded-lg border border-cyan-400/40 bg-cyan-400/10 p-3 text-sm text-cyan-100">
          Campaign throttle is hard-enforced at 1 email/minute per campaign.
        </div>
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
              onChange={(e) => updateTopLevelNumber('min_inbox_health_score', Number(e.target.value))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Min Domain Health Score (Pause below)</span>
            <input
              type="number"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.min_domain_health_score}
              onChange={(e) => updateTopLevelNumber('min_domain_health_score', Number(e.target.value))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Warmup Advance Min Health Score</span>
            <input
              type="number"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.warmup_advance_min_health_score}
              onChange={(e) => updateTopLevelNumber('warmup_advance_min_health_score', Number(e.target.value))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Warmup Advance Max Consecutive Failures</span>
            <input
              type="number"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.warmup_advance_max_consecutive_failures}
              onChange={(e) =>
                updateTopLevelNumber('warmup_advance_max_consecutive_failures', Number(e.target.value))
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
              onChange={(e) => updateTopLevelNumber('risky_daily_percent_limit', Number(e.target.value))}
            />
            <span className="text-xs text-muted-foreground">
              Per inbox/day cap for risky sends. Example: 10 daily limit + 20% = 2 risky max.
            </span>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-lg font-medium">Allowed Sending Schedule</h2>
        <p className="text-xs text-muted-foreground">
          Sends run only on selected days and within the selected local time window.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.schedule_enabled}
              onChange={(e) => setConfig((prev) => ({ ...prev, schedule_enabled: e.target.checked }))}
            />
            <span>Enable schedule enforcement</span>
          </label>

          <label className="text-sm space-y-1">
            <span>Timezone (IANA)</span>
            <input
              type="text"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.schedule_timezone}
              onChange={(e) => setConfig((prev) => ({ ...prev, schedule_timezone: e.target.value }))}
              placeholder="Asia/Kolkata"
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Send Window Start</span>
            <input
              type="time"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.send_window_start}
              onChange={(e) => setConfig((prev) => ({ ...prev, send_window_start: e.target.value }))}
            />
          </label>

          <label className="text-sm space-y-1">
            <span>Send Window End</span>
            <input
              type="time"
              className="w-full border border-border bg-background rounded px-3 py-2"
              value={config.send_window_end}
              onChange={(e) => setConfig((prev) => ({ ...prev, send_window_end: e.target.value }))}
            />
          </label>
        </div>

        <div className="space-y-2">
          <div className="text-sm">Allowed Weekdays</div>
          <div className="flex flex-wrap gap-2">
            {weekdayOptions.map((day) => {
              const selected = (config.allowed_weekdays ?? defaultWeekdays).includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeekday(day.value)}
                  className={`px-3 py-1.5 rounded border text-sm ${
                    selected
                      ? 'border-cyan-400/70 bg-cyan-400/15 text-cyan-100'
                      : 'border-border hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
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
              {config.warmup_steps.map((step) => (
                <tr key={step.id} className="border-b border-border">
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      className="w-24 border border-border bg-background rounded px-2 py-1"
                      value={step.day}
                      onChange={(e) => updateStep(step.id, 'day', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      className="w-32 border border-border bg-background rounded px-2 py-1"
                      value={step.daily_limit}
                      onChange={(e) => updateStep(step.id, 'daily_limit', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      className="w-32 border border-border bg-background rounded px-2 py-1"
                      value={step.hourly_limit}
                      onChange={(e) => updateStep(step.id, 'hourly_limit', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => removeStep(step.id)}
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
