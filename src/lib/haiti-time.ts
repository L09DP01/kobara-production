export const HAITI_TIME_ZONE = 'America/Port-au-Prince';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HAITI_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function haitiDayKey(date: Date) {
  const parts = dayFormatter.formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export function formatHaitiDateTime(value: string) {
  return new Date(value).toLocaleString('fr-FR', { timeZone: HAITI_TIME_ZONE });
}
