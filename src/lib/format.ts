const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function parseIsoDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return { year, month, day };
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const { year, month, day } = parseIsoDate(value);
  if (!year || !month || !day) {
    return value;
  }
  return `${MONTHS[month - 1]} ${String(day).padStart(2, '0')}, ${year}`;
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) {
    const a = parseIsoDate(start);
    const b = parseIsoDate(end);
    if (a.year === b.year) {
      return `${MONTHS[a.month - 1]} ${String(a.day).padStart(2, '0')} - ${MONTHS[b.month - 1]} ${String(b.day).padStart(2, '0')}, ${b.year}`;
    }
    return `${formatDate(start)} - ${formatDate(end)}`;
  }
  if (start) {
    return `FROM ${formatDate(start)}`;
  }
  if (end) {
    return `UNTIL ${formatDate(end)}`;
  }
  return 'NO DATES';
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'JUST NOW';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'HOUR' : 'HOURS'} AGO`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'DAY' : 'DAYS'} AGO`;
  return formatDate(new Date(iso).toISOString());
}

export function shortName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
