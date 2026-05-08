type SequenceStep = {
  id?: string;
  step_number?: number;
  subject?: string | null;
  delay_days?: number | null;
};

type CampaignLead = {
  status?: string | null;
  current_step?: number | null;
};

type Campaign = {
  status?: string | null;
  started_at?: string | null;
};

type NodeState = 'completed' | 'active' | 'failed' | 'pending' | 'not_started';

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

export default function CampaignJourneyMap({
  campaign,
  sequenceName,
  sequenceSteps,
  campaignLeads
}: {
  campaign: Campaign;
  sequenceName: string;
  sequenceSteps: SequenceStep[];
  campaignLeads: CampaignLead[];
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

  const stepMetrics = Array.from({ length: stepCount }, () => ({
    completed: 0,
    active: 0,
    failed: 0,
    pending: 0
  }));

  for (const lead of campaignLeads) {
    const status = String(lead.status ?? '').toLowerCase();
    const currentStep = Number(lead.current_step ?? 1);
    const targetIndex = clamp(currentStep - 1, 0, Math.max(stepCount - 1, 0));

    if (status === 'completed' || status === 'replied') {
      for (let i = 0; i < stepCount; i += 1) stepMetrics[i].completed += 1;
      continue;
    }

    if (status === 'failed') {
      for (let i = 0; i < targetIndex; i += 1) stepMetrics[i].completed += 1;
      stepMetrics[targetIndex].failed += 1;
      continue;
    }

    if (status === 'processing') {
      for (let i = 0; i < targetIndex; i += 1) stepMetrics[i].completed += 1;
      stepMetrics[targetIndex].active += 1;
      for (let i = targetIndex + 1; i < stepCount; i += 1) stepMetrics[i].pending += 1;
      continue;
    }

    for (let i = 0; i < targetIndex; i += 1) stepMetrics[i].completed += 1;
    stepMetrics[targetIndex].pending += 1;
    for (let i = targetIndex + 1; i < stepCount; i += 1) stepMetrics[i].pending += 1;
  }

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
