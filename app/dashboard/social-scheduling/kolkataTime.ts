export const KOLKATA_TIMEZONE = 'Asia/Kolkata';
const KOLKATA_OFFSET_MS = 330 * 60_000;

export function kolkataFields(instant: Date): { date: string; time: string; hour: number; day: number; month: number; year: number } {
  const shifted = new Date(instant.getTime() + KOLKATA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    hour, day, month, year,
  };
}

export function kolkataDateTimeToUtc(date: string, time: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !clock) return null;
  const [, year, month, day] = match.map(Number);
  const [, hour, minute] = clock.map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const result = new Date(wallClock - KOLKATA_OFFSET_MS);
  const fields = kolkataFields(result);
  return fields.date === date && fields.time === time ? result : null;
}

export function formatKolkata(instant: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: KOLKATA_TIMEZONE }).format(instant);
}
