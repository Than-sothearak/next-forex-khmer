import { createHash } from 'node:crypto';
import { countries } from '../countries';
import type { CalendarEvent } from '../types';
import { ProviderError, utcTimestamp } from './trading-economics-data';

export type ApifySource = 'forexfactory' | 'fxstreet' | 'pintostudio';
export const APIFY_ACTOR_URL = 'https://apify.com/pintostudio/economic-calendar-data-investing-com';
export const APIFY_EVENT_LIMIT = 500;
export const apifySourceNames = { forexfactory: 'Forex Factory', fxstreet: 'FXStreet', pintostudio: 'Pinto Studio' };

const currencyCountries: Record<string, string> = {
  USD: 'United States', EUR: 'Euro Area', GBP: 'United Kingdom', JPY: 'Japan', CAD: 'Canada',
  AUD: 'Australia', NZD: 'New Zealand', CHF: 'Switzerland', CNY: 'China', KRW: 'South Korea',
  INR: 'India', BRL: 'Brazil', MXN: 'Mexico', RUB: 'Russia', ZAR: 'South Africa', TRY: 'Turkey',
  IDR: 'Indonesia', SGD: 'Singapore', HKD: 'Hong Kong', NOK: 'Norway', SEK: 'Sweden',
  DKK: 'Denmark', PLN: 'Poland', CZK: 'Czech Republic', KHR: 'Cambodia', ALL: 'Global',
};
const countryCodes: Record<string, string> = {
  US: 'USD', GB: 'GBP', UK: 'GBP', EU: 'EUR', JP: 'JPY', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
  CH: 'CHF', CN: 'CNY', KR: 'KRW', IN: 'INR', BR: 'BRL', MX: 'MXN', RU: 'RUB', ZA: 'ZAR',
  TR: 'TRY', ID: 'IDR', SG: 'SGD', HK: 'HKD', NO: 'NOK', SE: 'SEK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
};
function value(input: unknown, required = false, max = 2000): string | null {
  if (input == null || input === '') {
    if (required) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    return null;
  }
  if ((typeof input !== 'string' && typeof input !== 'number') || (typeof input === 'number' && !Number.isFinite(input))) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
  const result = String(input).trim();
  if (result.length > max || (required && !result)) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
  return result || null;
}
export function normalizeApifyEvents(payload: unknown, source: ApifySource): CalendarEvent[] {
  let rows: unknown[] = [];
  if (Array.isArray(payload)) {
    rows = payload;
  } else if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      rows = record.items as unknown[];
    } else if (record.data && typeof record.data === 'object') {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.items)) rows = nested.items as unknown[];
      else throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    } else {
      throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    }
  } else {
    throw new ProviderError('INVALID_PROVIDER_RESPONSE');
  }
  if (rows.length > APIFY_EVENT_LIMIT + 1) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
  const events = new Map<string, CalendarEvent>();
  let count = 0;
  for (const item of rows) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    const row = item as Record<string, unknown>;
    // The Actor emits a weekly outlook summary as well as event rows. It is not
    // an economic release and can include fields that resemble an event.
    if (row.type === 'week_outlook' || row._record_type === 'week_outlook') continue;
    // Current Actor output omits data_source; the adapter requests one explicit
    // source per run. If a source label is supplied, still reject mismatches.
    const returnedSource = value(row.data_source, false, 40)?.toLowerCase();
    if (returnedSource && returnedSource !== source) throw new ProviderError('APIFY_UNEXPECTED_SOURCE');
    if (!['high', 'medium', 'low'].includes(String(row.impact))) throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    const titleEn = value(row.title, true, 500)!;
    const rawCountry = value(row.country ?? row.country_name ?? row.countryCode ?? row.country_iso2, true, 80)!;
    const currencyCode = countryCodes[rawCountry] || rawCountry;
    const country = currencyCountries[currencyCode] || rawCountry;
    const currency = currencyCode === 'ALL' ? '' : /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : countries[country]?.currency || '';
    const date = value(row.date_iso ?? row.date ?? row.dateTime ?? row.isoDate ?? row.event_date, true, 100)!;
    // Unlike Trading Economics, the Actor promises offset-bearing dates. Never guess ET/DST.
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(date)) throw new ProviderError('INVALID_PROVIDER_DATE');
    const eventAt = utcTimestamp(date);
    const canonicalId = value(row.canonical_event_id, false, 500);
    // Canonical IDs identify recurring series, so include the occurrence timestamp.
    const providerId = createHash('sha256').update(JSON.stringify([source, rawCountry, canonicalId || titleEn, eventAt])).digest('hex');
    const event: CalendarEvent = {
      provider: `apify-${source}`, providerId, titleEn, titleKm: null,
      descriptionEn: value(row.description), descriptionKm: null, country, currency, eventAt,
      timeTentative: row.time_tentative === true,
      impact: row.impact as CalendarEvent['impact'],
      actual: value(row.actual, false, 100), forecast: value(row.forecast, false, 100), previous: value(row.previous, false, 100),
      source: `Apify · ${apifySourceNames[source]}`, sourceUrl: APIFY_ACTOR_URL,
      providerUpdatedAt: null, // The Actor does not document an upstream revision timestamp.
    };
    const existing = events.get(providerId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) throw new ProviderError('APIFY_CONFLICTING_EVENTS');
    events.set(providerId, event);
    count++;
  }
  if (count >= APIFY_EVENT_LIMIT) throw new ProviderError('PROVIDER_RESULT_LIMIT');
  // The Actor may hide upstream errors behind an empty dataset. Preserve the cache.
  if (!count) throw new ProviderError('APIFY_EMPTY_RESPONSE');
  return [...events.values()];
}
