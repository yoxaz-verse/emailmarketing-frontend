import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server/server-fetch';
import SendingLimitsClient from './sending-limits-client';

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
  schedule_enabled: boolean;
  schedule_timezone: string;
  allowed_weekdays: number[];
  send_window_start: string;
  send_window_end: string;
  warmup_steps: WarmupStep[];
};

export default async function SendingLimitsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = role === 'admin' || role === 'superadmin';

  if (!isAdmin) {
    redirect('/dashboard');
  }

  const fallbackConfig: SendingLimitsConfig = {
    min_inbox_health_score: 60,
    min_domain_health_score: 60,
    warmup_advance_min_health_score: 70,
    warmup_advance_max_consecutive_failures: 2,
    risky_daily_percent_limit: 20,
    schedule_enabled: true,
    schedule_timezone: 'Asia/Kolkata',
    allowed_weekdays: [0, 1, 2, 3, 4, 5, 6],
    send_window_start: '00:00',
    send_window_end: '23:59',
    warmup_steps: [
      { day: 1, daily_limit: 20, hourly_limit: 5 },
      { day: 2, daily_limit: 30, hourly_limit: 8 },
      { day: 3, daily_limit: 40, hourly_limit: 10 },
      { day: 4, daily_limit: 60, hourly_limit: 15 },
      { day: 5, daily_limit: 80, hourly_limit: 20 },
    ],
  };

  let loadError: string | undefined;
  let config: SendingLimitsConfig = fallbackConfig;
  try {
    config = await serverFetch<SendingLimitsConfig>('/admin/sending-limits');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    loadError =
      message ||
      'Could not load sending limits from backend. Showing fallback defaults.';
  }

  return <SendingLimitsClient initialConfig={config} loadError={loadError} />;
}
