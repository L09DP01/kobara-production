export const WITHDRAWAL_TIME_ZONE = 'America/Port-au-Prince';

const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: WITHDRAWAL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const offsetFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: WITHDRAWAL_TIME_ZONE, timeZoneName: 'longOffset',
});

function localMidnightToUtc(year: number, month: number, day: number) {
  const local = Date.UTC(year, month - 1, day);
  let utc = local;
  // Resolve the offset at each midnight independently, including DST changes.
  for (let attempt = 0; attempt < 3; attempt++) {
    const offset = offsetFormat.formatToParts(new Date(utc)).find((part) => part.type === 'timeZoneName')?.value;
    const match = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
    if (!match) throw new Error('withdrawal_timezone_unavailable');
    const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '+' ? 1 : -1);
    const next = local - minutes * 60_000;
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc).toISOString();
}

export function getWithdrawalDayBounds(now: Date = new Date()) {
  const parts = localDate.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const year = value('year');
  const month = value('month');
  const day = value('day');
  return {
    start: localMidnightToUtc(year, month, day),
    end: localMidnightToUtc(year, month, day + 1),
  };
}
