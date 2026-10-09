export const TIME_ZONE = 'Asia/Phnom_Penh';
export const DAY_MS = 86_400_000;
export function cambodiaDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function addDays(day: string, amount: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + amount * DAY_MS).toISOString().slice(0, 10);
}
export function calendarPresets(today: string) {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, -((weekday + 6) % 7));
  const previousMonthEnd = addDays(`${today.slice(0, 7)}-01`, -1);
  return [
    { id: 'yesterday', label: 'ម្សិលមិញ', from: addDays(today, -1), to: addDays(today, -1) },
    { id: 'today', label: 'ថ្ងៃនេះ', from: today, to: today },
    { id: 'tomorrow', label: 'ថ្ងៃស្អែក', from: addDays(today, 1), to: addDays(today, 1) },
    { id: 'next-seven-days', label: '៧ ថ្ងៃបន្ទាប់', from: today, to: addDays(today, 6) },
    { id: 'last-week', label: 'សប្ដាហ៍មុន', from: addDays(monday, -7), to: addDays(monday, -1) },
    { id: 'last-month', label: 'ខែមុន', from: `${previousMonthEnd.slice(0, 7)}-01`, to: previousMonthEnd },
  ];
}
export function validDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}
export function dayBounds(from: string, to: string): { from: Date; to: Date } {
  if (!validDay(from) || !validDay(to) || from > to) throw new Error('INVALID_DATE_RANGE');
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(`${addDays(to, 1)}T00:00:00+07:00`);
  if (end.getTime() - start.getTime() > 31 * DAY_MS) throw new Error('DATE_RANGE_TOO_LONG');
  return { from: start, to: end };
}
export function calendarQuery(params: URLSearchParams) {
  const today = cambodiaDate();
  const range = dayBounds(params.get('from') || today, params.get('to') || today);
  const currency = params.get('currency') || '';
  const country = params.get('country') || '';
  const impact = params.get('impact') || '';
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new Error('INVALID_CURRENCY');
  if (country.length > 80 || (country && !/^[\p{L} .()'-]+$/u.test(country))) throw new Error('INVALID_COUNTRY');
  if (impact && !['high', 'medium', 'low'].includes(impact)) throw new Error('INVALID_IMPACT');
  return { ...range, currency, country, impact };
}

// Some browsers lack Khmer ICU date data. Explicit labels avoid English fallback
// and server/client hydration differences while keeping the same UTC+7 date.
export function khmerDateLabel(day: string): string {
  const weekdays = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
  const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const date = new Date(`${day}T00:00:00Z`);
  const khmerNumber = (value: number) => String(value).replace(/\d/g, digit => '០១២៣៤៥៦៧៨៩'[Number(digit)]);
  return `ថ្ងៃ${weekdays[date.getUTCDay()]} ទី${khmerNumber(date.getUTCDate())} ${months[date.getUTCMonth()]} ${khmerNumber(date.getUTCFullYear())}`;
}
