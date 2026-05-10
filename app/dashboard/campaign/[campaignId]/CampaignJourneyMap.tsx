type SequenceStep = {
  id?: string;
  step_number?: number;
  subject?: string | null;
  delay_days?: number | null;
};

type CampaignLead = {
  status?: string | null;
  current_step?: number | null;
  lead_id?: string | null;
};

type Campaign = {
  status?: string | null;
  started_at?: string | null;
};

type Lead = {
  id?: string | null;
  email?: string | null;
  email_eligibility?: string | null;
  is_blocked?: boolean | null;
  permanently_failed?: boolean | null;
};

type Inbox = {
  id?: string;
  daily_limit?: number | null;
  warmup_enabled?: boolean | null;
  warmup_day?: number | null;
};

type CampaignInbox = {
  inbox_id?: string | null;
};

type SendingLimitsConfig = {
  warmup_steps?: Array<{
    day: number;
    daily_limit: number;
    hourly_limit: number;
  }>;
} | null;

type NodeState = 'completed' | 'active' | 'failed' | 'pending' | 'not_started';
type StepProgressState = 'sent' | 'in_progress' | 'failed' | 'pending';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getNodeStateFromMetrics(metrics: {
  completed: number;
  active: number;
  failed: number;
  pending: number;
}, isStarted: boolean): NodeState {
  if (!isStarted) return 'not_started';
  if (metrics.active > 0) return 'active';
  if (metrics.pending > 0) return 'pending';
  if (metrics.completed > 0) return 'completed';
  if (metrics.failed > 0) return 'failed';
  return 'pending';
}

function resolveInboxDailyCapacity(inbox: Inbox, sendingLimitsConfig: SendingLimitsConfig): number {
  const defaultDaily = Math.max(0, Number(inbox.daily_limit ?? 0));
  if (!inbox.warmup_enabled || !sendingLimitsConfig?.warmup_steps?.length) {
    return defaultDaily;
  }
  const day = Math.max(1, Number(inbox.warmup_day ?? 1));
  const step = sendingLimitsConfig.warmup_steps.find((s) => Number(s.day) === day);
  if (!step) return defaultDaily;
  return Math.max(0, Number(step.daily_limit ?? defaultDaily));
}

function formatDateFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, days));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDateFromAnchor(anchor: Date, days: number): string {
  const date = new Date(anchor);
  date.setDate(date.getDate() + Math.max(0, days));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getLeadStepState(
  leadStatus: string,
  currentStep: number,
  stepIndex: number,
  stepCount: number
): StepProgressState {
  const sentSteps = clamp(currentStep - 1, 0, stepCount);
  const currentIndex = sentSteps;

  if (stepIndex < sentSteps) return 'sent';
  if (stepIndex > currentIndex) return 'pending';

  if (leadStatus === 'processing') return 'in_progress';
  if (leadStatus === 'failed') return 'failed';
  if (leadStatus === 'completed' || leadStatus === 'replied') {
    return currentStep > stepCount ? 'sent' : 'pending';
  }

  return 'pending';
}

export default function CampaignJourneyMap({
  campaign,
  sequenceName,
  sequenceSteps,
  campaignLeads,
  allLeads,
  inboxes,
  campaignInboxes,
  sendingLimitsConfig
}: {
  campaign: Campaign;
  sequenceName: string;
  sequenceSteps: SequenceStep[];
  campaignLeads: CampaignLead[];
  allLeads: Lead[];
  inboxes: Inbox[];
  campaignInboxes: CampaignInbox[];
  sendingLimitsConfig: SendingLimitsConfig;
}) {
  const sortedSteps = [...sequenceSteps].sort(
    (a, b) => (a.step_number ?? 0) - (b.step_number ?? 0)
  );
  const stepCount = sortedSteps.length;

  if (stepCount === 0) {
    return (
      <section className="rounded-xl border border-border bg-card/70 p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Campaign Journey
        </div>
        <div className="mt-4 h-40 rounded-lg border border-dashed border-border/70 bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
          Add sequence steps to render the journey map.
        </div>
      </section>
    );
  }

  const delayDays = sortedSteps.map((step) => Math.max(0, Number(step.delay_days ?? 0)));
  const cumulativeDays = delayDays.reduce<number[]>(
    (acc, delay, index) => {
      if (index === 0) return [delay];
      acc.push(acc[index - 1] + delay);
      return acc;
    },
    []
  );
  const totalPlannedDays = delayDays.reduce((sum, d) => sum + d, 0);

  const isStarted = Boolean(
    campaign.started_at ||
    (campaign.status && !['draft', 'paused'].includes(String(campaign.status).toLowerCase()))
  );

  if (!isStarted) {
    const leadMap = new Map<string, Lead>();
    for (const lead of allLeads) {
      if (lead.id) leadMap.set(String(lead.id), lead);
    }

    const selectedInboxIdSet = new Set(
      campaignInboxes.map((row) => String(row.inbox_id ?? '')).filter(Boolean)
    );
    const selectedInboxes = inboxes.filter((inbox) => selectedInboxIdSet.has(String(inbox.id ?? '')));
    const totalDailyCapacity = selectedInboxes.reduce((sum, inbox) => (
      sum + resolveInboxDailyCapacity(inbox, sendingLimitsConfig)
    ), 0);

    const attachableLeadCount = campaignLeads.reduce((count, row) => {
      const lead = leadMap.get(String(row.lead_id ?? ''));
      if (!lead) return count;
      if (lead.is_blocked === true || lead.permanently_failed === true) return count;
      const status = String(lead.email_eligibility ?? '').toLowerCase();
      if (status === 'eligible' || status === 'risky') return count + 1;
      return count;
    }, 0);

    const totalSends = attachableLeadCount * stepCount;
    const processingDays = totalDailyCapacity > 0
      ? Math.ceil(totalSends / Math.max(totalDailyCapacity, 1))
      : 0;
    const sequenceLagDays = totalPlannedDays;
    const estimatedCompletionDays = processingDays + sequenceLagDays;
    const simulationAnchor = new Date();
    const stepSchedule = sortedSteps.map((step, index) => {
      const runDay = cumulativeDays[index] ?? 0;
      return {
        stepNumber: step.step_number ?? index + 1,
        delayAfterPrevious: delayDays[index] ?? 0,
        runDay,
        runDateLabel: formatDateFromAnchor(simulationAnchor, runDay)
      };
    });

    return (
      <section className="rounded-xl border border-border bg-[radial-gradient(130%_100%_at_8%_0%,rgba(34,211,238,0.14),rgba(15,23,42,0.08)_45%,rgba(2,6,23,0.02)_80%)] p-5 overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">
              Campaign Journey Simulation
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {sequenceName} • pre-launch estimate
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Estimated Completion</p>
            <p className="text-2xl font-semibold text-cyan-100">{estimatedCompletionDays}d</p>
            <p className="text-xs text-muted-foreground">~ {formatDateFromNow(estimatedCompletionDays)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2">
            <div className="text-muted-foreground">Selected Inboxes</div>
            <div className="mt-1 text-base font-semibold text-slate-100">{selectedInboxes.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2">
            <div className="text-muted-foreground">Attachable Leads</div>
            <div className="mt-1 text-base font-semibold text-slate-100">{attachableLeadCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2">
            <div className="text-muted-foreground">Daily Capacity</div>
            <div className="mt-1 text-base font-semibold text-slate-100">{totalDailyCapacity}/day</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2">
            <div className="text-muted-foreground">Total Sends</div>
            <div className="mt-1 text-base font-semibold text-slate-100">{totalSends}</div>
          </div>
        </div>

        {selectedInboxes.length === 0 ? (
          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Select at least one inbox to simulate campaign end date.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
              <div className="text-xs text-muted-foreground mb-3">
                Campaign Schedule Timeline
              </div>
              <div className="overflow-x-auto">
                <div className="relative min-w-[700px] h-28">
                  <div className="absolute left-0 right-0 top-11 h-2 rounded-full bg-slate-700/60" />
                  <div className="absolute left-0 top-11 h-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-teal-300 w-full" />

                  <div className="absolute left-0 top-0 text-[11px] text-cyan-200">
                    Start Day 0 • {formatDateFromAnchor(simulationAnchor, 0)}
                  </div>
                  <div className="absolute right-0 top-0 text-[11px] text-teal-200 text-right">
                    End Day {estimatedCompletionDays} • {formatDateFromAnchor(simulationAnchor, estimatedCompletionDays)}
                  </div>

                  {stepSchedule.map((step, index) => {
                    const left = estimatedCompletionDays > 0
                      ? (step.runDay / estimatedCompletionDays) * 100
                      : 0;
                    const safeLeft = clamp(left, 0, 100);
                    const isEven = index % 2 === 0;
                    return (
                      <div
                        key={`schedule-step-${step.stepNumber}-${index}`}
                        className="absolute"
                        style={{ left: `${safeLeft}%`, top: isEven ? '34px' : '76px', transform: 'translateX(-50%)' }}
                      >
                        <div className="h-5 w-5 rounded-full border-2 border-cyan-100 bg-cyan-400 shadow-[0_0_0_3px_rgba(6,182,212,0.25)]" />
                        <div className={`mt-1 whitespace-nowrap text-[10px] ${isEven ? 'text-slate-100' : 'text-slate-300'}`}>
                          S{step.stepNumber} • Day {step.runDay} • {step.runDateLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
              <div className="text-xs text-muted-foreground mb-3">
                Sequence Schedule
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-400 border-b border-white/10">
                      <th className="py-2 pr-4 font-medium">Sequence</th>
                      <th className="py-2 pr-4 font-medium">Delay After Previous</th>
                      <th className="py-2 pr-4 font-medium">Runs On Day</th>
                      <th className="py-2 font-medium">Estimated Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stepSchedule.map((step, index) => (
                      <tr key={`schedule-row-${step.stepNumber}-${index}`} className="border-b border-white/5">
                        <td className="py-2 pr-4 text-slate-100">S{step.stepNumber}</td>
                        <td className="py-2 pr-4 text-slate-300">+{step.delayAfterPrevious}d</td>
                        <td className="py-2 pr-4 text-slate-300">Day {step.runDay}</td>
                        <td className="py-2 text-slate-200">{step.runDateLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md border border-white/10 px-3 py-2 text-slate-300">
                  Processing Days: <span className="text-slate-100 font-medium">{processingDays}d</span>
                </div>
                <div className="rounded-md border border-white/10 px-3 py-2 text-slate-300">
                  Sequence Delay Days: <span className="text-slate-100 font-medium">{sequenceLagDays}d</span>
                </div>
                <div className="rounded-md border border-white/10 px-3 py-2 text-slate-300">
                  Total Estimated Duration: <span className="text-slate-100 font-medium">{estimatedCompletionDays}d</span>
                </div>
                <div className="rounded-md border border-white/10 px-3 py-2 text-slate-300">
                  Estimated End Date: <span className="text-slate-100 font-medium">{formatDateFromAnchor(simulationAnchor, estimatedCompletionDays)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  const stepMetrics = Array.from({ length: stepCount }, () => ({
    completed: 0,
    active: 0,
    failed: 0,
    pending: 0
  }));
  const stepProgressSummary = Array.from({ length: stepCount }, () => ({
    sent: 0,
    in_progress: 0,
    failed: 0,
    pending: 0
  }));

  const leadById = new Map<string, Lead>();
  for (const lead of allLeads) {
    if (lead.id) leadById.set(String(lead.id), lead);
  }

  const leadProgressRows = campaignLeads.map((row, rowIndex) => {
    const status = String(row.status ?? '').toLowerCase();
    const currentStep = Number(row.current_step ?? 1);
    const lead = leadById.get(String(row.lead_id ?? ''));
    const stepStates = Array.from({ length: stepCount }, (_, stepIndex) =>
      getLeadStepState(status, currentStep, stepIndex, stepCount)
    );

    for (let i = 0; i < stepCount; i += 1) {
      const stepState = stepStates[i];
      if (stepState === 'sent') {
        stepMetrics[i].completed += 1;
        stepProgressSummary[i].sent += 1;
      } else if (stepState === 'in_progress') {
        stepMetrics[i].active += 1;
        stepProgressSummary[i].in_progress += 1;
      } else if (stepState === 'failed') {
        stepMetrics[i].failed += 1;
        stepProgressSummary[i].failed += 1;
      } else {
        stepMetrics[i].pending += 1;
        stepProgressSummary[i].pending += 1;
      }
    }

    const stepsDone = stepStates.filter((state) => state === 'sent').length;
    const hasProgressMismatch = (status === 'completed' || status === 'replied') && currentStep <= stepCount;
    const fallbackLeadId = String(row.lead_id ?? `row-${rowIndex + 1}`);
    return {
      key: `${fallbackLeadId}-${rowIndex}`,
      leadLabel: lead?.email || fallbackLeadId,
      leadId: fallbackLeadId,
      rawStatus: status || 'pending',
      stepsDone,
      hasProgressMismatch,
      stepStates
    };
  });

  const stepStates = stepMetrics.map((metrics) =>
    getNodeStateFromMetrics(metrics, isStarted)
  );

  const completedSteps = stepStates.filter((state) => state === 'completed').length;
  const activeIndex = stepStates.findIndex((state) => state === 'active');
  const progressStepBase =
    activeIndex >= 0
      ? activeIndex + 0.5
      : completedSteps;
  const overallProgress = stepCount > 0 ? clamp(progressStepBase / stepCount, 0, 1) : 0;

  const svgWidth = 940;
  const svgHeight = 270;
  const marginX = 46;
  const laneWidth = svgWidth - marginX * 2;
  const baseline = svgHeight / 2;

  const points = sortedSteps.map((_, index) => {
    const t = stepCount === 1 ? 0.5 : index / (stepCount - 1);
    const x = marginX + t * laneWidth;
    const wave = Math.sin(t * Math.PI * 2.2) * 44;
    const y = baseline - wave;
    return { x, y, t };
  });

  const fullPath = points
    .map((pt, index) => `${index === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ');
  const progressPath = points
    .filter((pt) => pt.t <= overallProgress)
    .map((pt, index) => `${index === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ');

  const stateClasses: Record<NodeState, string> = {
    completed: 'fill-emerald-400 stroke-emerald-200/90',
    active: 'fill-cyan-400 stroke-cyan-200/90',
    failed: 'fill-rose-400 stroke-rose-200/90',
    pending: 'fill-slate-600 stroke-slate-400/60',
    not_started: 'fill-slate-500/80 stroke-slate-300/70'
  };
  const stepStatusChipClasses: Record<StepProgressState, string> = {
    sent: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
    in_progress: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-200',
    failed: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
    pending: 'border-slate-500/30 bg-slate-500/15 text-slate-200'
  };
  const stepStatusLabel: Record<StepProgressState, string> = {
    sent: 'Sent',
    in_progress: 'In Progress',
    failed: 'Failed',
    pending: 'Pending'
  };

  return (
    <section className="rounded-xl border border-border bg-[radial-gradient(130%_100%_at_8%_0%,rgba(34,211,238,0.14),rgba(15,23,42,0.08)_45%,rgba(2,6,23,0.02)_80%)] p-5 overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">
            Campaign Journey
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {sequenceName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Total Planned
          </p>
          <p className="text-2xl font-semibold text-cyan-100">
            {totalPlannedDays}d
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/35 p-3">
        <div className="hidden md:block">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
            <defs>
              <linearGradient id="journey-track" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(56,189,248,0.15)" />
                <stop offset="100%" stopColor="rgba(148,163,184,0.2)" />
              </linearGradient>
              <linearGradient id="journey-progress" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#2dd4bf" />
              </linearGradient>
            </defs>

            <path d={fullPath} stroke="url(#journey-track)" strokeWidth="16" fill="none" strokeLinecap="round" />
            {progressPath ? (
              <path
                d={progressPath}
                stroke="url(#journey-progress)"
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
                className={activeIndex >= 0 ? 'journey-pulse' : ''}
              />
            ) : null}

            {points.map((pt, index) => {
              const state = stepStates[index];
              return (
                <g key={`${sortedSteps[index].id ?? index}-node`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="11"
                    className={`${stateClasses[state]} stroke-[2.5]`}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="18"
                    className="stroke-white/10 fill-transparent"
                  />
                  <text x={pt.x} y={pt.y - 26} textAnchor="middle" className="fill-slate-200 text-[11px]">
                    Day {cumulativeDays[index]}
                  </text>
                  <text x={pt.x} y={pt.y + 34} textAnchor="middle" className="fill-slate-300 text-[11px]">
                    S{sortedSteps[index].step_number ?? index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="md:hidden overflow-x-auto">
          <div className="min-w-[640px] relative py-10 px-2">
            <div className="absolute left-2 right-2 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-slate-700/60" />
            <div
              className="absolute left-2 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-300 transition-all duration-500"
              style={{ width: `${Math.max(4, overallProgress * 100)}%` }}
            />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-1 relative z-10">
              {sortedSteps.map((step, index) => {
                const state = stepStates[index];
                return (
                  <div key={step.id ?? index} className="text-center">
                    <div className={`mx-auto h-5 w-5 rounded-full border-2 ${stateClasses[state]}`} />
                    <div className="mt-2 text-[10px] text-slate-300">S{step.step_number ?? index + 1}</div>
                    <div className="text-[10px] text-slate-400">Day {cumulativeDays[index]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full rounded-full bg-slate-700/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-teal-300 transition-all duration-500"
          style={{ width: `${overallProgress * 100}%` }}
        />
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/35 p-4 space-y-4">
        <div className="text-xs text-muted-foreground">
          Step Progress Details
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-400 border-b border-white/10">
                <th className="py-2 pr-4 font-medium">Step</th>
                <th className="py-2 pr-4 font-medium">Sent</th>
                <th className="py-2 pr-4 font-medium">Pending</th>
                <th className="py-2 pr-4 font-medium">Failed</th>
                <th className="py-2 pr-4 font-medium">In Progress</th>
                <th className="py-2 font-medium">Total Leads</th>
              </tr>
            </thead>
            <tbody>
              {sortedSteps.map((step, index) => {
                const summary = stepProgressSummary[index];
                return (
                  <tr key={`step-progress-summary-${step.id ?? index}`} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-slate-100">S{step.step_number ?? index + 1}</td>
                    <td className="py-2 pr-4 text-emerald-200">{summary.sent}</td>
                    <td className="py-2 pr-4 text-slate-200">{summary.pending}</td>
                    <td className="py-2 pr-4 text-rose-200">{summary.failed}</td>
                    <td className="py-2 pr-4 text-cyan-200">{summary.in_progress}</td>
                    <td className="py-2 text-slate-100">{campaignLeads.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <details open className="rounded-md border border-white/10 bg-slate-900/35">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm text-slate-200 flex items-center justify-between">
            <span>Lead-Level Step Status ({leadProgressRows.length})</span>
            <span className="text-xs text-slate-400">Expand/Collapse</span>
          </summary>
          <div className="px-3 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">Lead</th>
                    <th className="py-2 pr-3 font-medium">Steps Done</th>
                    <th className="py-2 pr-3 font-medium">Data Check</th>
                    {sortedSteps.map((step, index) => (
                      <th key={`lead-header-step-${step.id ?? index}`} className="py-2 pr-3 font-medium">
                        S{step.step_number ?? index + 1}
                      </th>
                    ))}
                    <th className="py-2 font-medium">Current Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leadProgressRows.map((row) => (
                    <tr key={row.key} className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-100">{row.leadLabel}</td>
                      <td className="py-2 pr-3 text-slate-200">{row.stepsDone}/{stepCount}</td>
                      <td className="py-2 pr-3">
                        {row.hasProgressMismatch ? (
                          <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">
                            Status/Step mismatch
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">OK</span>
                        )}
                      </td>
                      {row.stepStates.map((state, idx) => (
                        <td key={`${row.key}-state-${idx}`} className="py-2 pr-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${stepStatusChipClasses[state]}`}>
                            {stepStatusLabel[state]}
                          </span>
                        </td>
                      ))}
                      <td className="py-2 text-slate-300">{row.rawStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </div>

      <style>{`
        .journey-pulse {
          animation: journeyPulse 1.8s ease-in-out infinite;
        }
        @keyframes journeyPulse {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(34, 211, 238, 0.4)); }
          50% { filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.85)); }
        }
      `}</style>
    </section>
  );
}
