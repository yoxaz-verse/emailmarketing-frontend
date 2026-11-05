const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function formatEventCountdown(startsAt: string, nowMs: number): string {
  const startsAtMs = new Date(startsAt).getTime();
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(nowMs)) return 'Upcoming';

  const remainingMs = startsAtMs - nowMs;
  if (remainingMs <= 0) return 'Started';

  const totalMinutes = Math.ceil(remainingMs / MINUTE_MS);
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
