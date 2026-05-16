export type SendingLimitsApiWarmupStep = {
  day: number;
  daily_limit: number;
  hourly_limit: number;
};

export type SendingLimitsConfig = {
  min_inbox_health_score: number;
  min_domain_health_score: number;
  warmup_advance_min_health_score: number;
  warmup_advance_max_consecutive_failures: number;
  risky_daily_percent_limit: number;
  schedule_enabled: boolean;
  schedule_timezone: string;
  allowed_weekdays: number[];
  send_window_start: string;
  send_window_end: string;
  warmup_steps: SendingLimitsApiWarmupStep[];
};

export type SendingLimitsPayload = SendingLimitsConfig;

export type UiWarmupStep = SendingLimitsApiWarmupStep & {
  id: string;
};
