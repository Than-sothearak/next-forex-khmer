import { validDay } from '../dates';
import { countries } from '../countries';
import type { CalendarEvent } from '../types';
export class ProviderError extends Error {
  constructor(public code: string, public retryAfterSeconds = 300) { super(code); }
}
function text(value: unknown, required = false, max = 2000): string | null {
  if (value === null || value === undefined || value === '') {
    if (required) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    return null;
  }
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).length > max || (typeof value === 'number' && !Number.isFinite(value))) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
  const result = String(value).trim();
  if (required && !result) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
  return result || null;
}
export function utcTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(value)) throw new ProviderError('INVALID_PROVIDER_DATE');
  // Trading Economics documents calendar Date as UTC, even when the suffix is omitted.
  if (!validDay(value.slice(0, 10)) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) throw new ProviderError('INVALID_PROVIDER_DATE');
  const date = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  if (!Number.isFinite(date.getTime())) throw new ProviderError('INVALID_PROVIDER_DATE');
  return date.toISOString();
}
export function normalizeEvents(payload: unknown): CalendarEvent[] {
  if (!Array.isArray(payload)) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
  // The documented ceiling is 1,000 rows. Never silently publish a truncated calendar.
  if (payload.length >= 1000) throw new ProviderError('PROVIDER_RESULT_LIMIT');
  const events = new Map<string, CalendarEvent>();
  for (const item of payload) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    const row = item as Record<string, unknown>;
    const importance = Number(row.Importance);
    if (![1, 2, 3].includes(importance)) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    const country = text(row.Country, true, 80)!;
    const rawCurrency = text(row.Currency, false, 20) || '';
    const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : countries[country]?.currency || ''; 
    const sourceUrl = text(row.SourceURL);
    const span = row.DateSpan == null ? '1' : String(row.DateSpan);
    if (!['0', '1'].includes(span)) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    const event: CalendarEvent = {
      provider: 'trading-economics', providerId: text(row.CalendarId ?? row.CalendarID, true, 100)!,
      titleEn: text(row.Event, true, 500)!, titleKm: null,
      descriptionEn: text(row.Description, false, 2000), descriptionKm: null,
      country, currency,
      eventAt: utcTimestamp(row.Date), timeTentative: span !== '0',
      impact: importance === 3 ? 'high' : importance === 2 ? 'medium' : 'low',
      actual: text(row.Actual, false, 100), forecast: text(row.Forecast, false, 100), previous: text(row.Previous, false, 100),
      source: text(row.Source, false, 300) || 'Trading Economics',
      sourceUrl: sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null,
      providerUpdatedAt: row.LastUpdate ? utcTimestamp(row.LastUpdate) : null,
    };
    const previous = events.get(event.providerId);
    if (!previous || (event.providerUpdatedAt || '') >= (previous.providerUpdatedAt || '')) events.set(event.providerId, event);
  }
  return [...events.values()];
}
export function retryDelay(value: string | null, now = Date.now()): number {
  const seconds = value && /^\d+$/.test(value) ? Number(value) : value ? (Date.parse(value) - now) / 1000 : 300;
  return Number.isFinite(seconds) ? Math.max(60, Math.ceil(seconds)) : 300;
}
