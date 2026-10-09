import 'server-only';
import type { CalendarProvider } from '@/lib/calendar-provider';
import { calendarConfig } from '../config';
import { addDays } from '../dates';
import { ProviderError, retryDelay } from './trading-economics-data';
import { APIFY_ACTOR_URL, APIFY_EVENT_LIMIT, apifySourceNames, normalizeApifyEvents, type ApifySource } from './apify-data';

export class ApifyCalendarProvider implements CalendarProvider {
  readonly id: string;
  readonly name: string;
  readonly url = APIFY_ACTOR_URL;
  constructor(private readonly source: ApifySource) {
    this.id = `apify-${source}`;
    this.name = `Apify · ${apifySourceNames[source]}`;
  }
  async getEvents(from: Date, to: Date) {
    // Enforce configuration here as well as at adapter selection, before any paid run.
    const config = calendarConfig();
    if (!config.enabled || config.provider !== this.id) throw new ProviderError('PROVIDER_NOT_CONFIGURED');
    const actorId = {
      forexfactory: 'gochujang~economic-calendar-tracker',
      fxstreet: 'gochujang~economic-calendar-tracker',
      pintostudio: 'pintostudio~economic-calendar-data-investing-com',
    }[this.source] || process.env.APIFY_ACTOR_ID || 'pintostudio~economic-calendar-data-investing-com';
    const dateFrom = addDays(from.toISOString().slice(0, 10), -1);
    const dateTo = addDays(to.toISOString().slice(0, 10), 1);
    const legacyPayload = {
      source: this.source,
      dateFrom,
      dateTo,
      timezone: 'Asia/Phnom_Penh',
      sortBy: 'date_asc',
      limit: APIFY_EVENT_LIMIT,
      excludeHolidays: true,
      impactLevels: ['high', 'medium', 'low'],
    };
    const payloads = this.source === 'pintostudio'
      ? [legacyPayload, { dateFrom, dateTo, timezone: 'Asia/Phnom_Penh', limit: APIFY_EVENT_LIMIT }, { fromDate: dateFrom, toDate: dateTo, timezone: 'Asia/Phnom_Penh', limit: APIFY_EVENT_LIMIT }, { startDate: dateFrom, endDate: dateTo, timezone: 'Asia/Phnom_Penh', limit: APIFY_EVENT_LIMIT }, {}]
      : [legacyPayload];
    let lastResponse: Response | null = null;
    let lastFailure: ProviderError | null = null;
    for (const payload of payloads) {
      const url = new URL(`https://api.apify.com/v2/actors/${actorId}/run-sync-get-dataset-items`);
      url.searchParams.set('timeout', '120');
      url.searchParams.set('format', 'json');
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(130_000),
          headers: { Authorization: `Bearer ${process.env.APIFY_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch { throw new ProviderError('PROVIDER_UNAVAILABLE'); }
      lastResponse = response;
      if (response.status === 429) throw new ProviderError('PROVIDER_RATE_LIMIT', retryDelay(response.headers.get('retry-after')));
      if (response.status === 401 || response.status === 403) throw new ProviderError('PROVIDER_AUTHORIZATION');
      if (response.ok) {
        let payloadData: unknown;
        try { payloadData = await response.json(); } catch { throw new ProviderError('INVALID_PROVIDER_RESPONSE'); }
        try {
          return normalizeApifyEvents(payloadData, this.source).filter(event => new Date(event.eventAt) >= from && new Date(event.eventAt) < to);
        } catch (error) {
          if (error instanceof ProviderError && error.code === 'INVALID_PROVIDER_RESPONSE') {
            lastFailure = error;
            continue;
          }
          throw error;
        }
      }
      if (response.status !== 400 && response.status !== 422) break;
    }
    if (lastFailure) throw lastFailure;
    if (lastResponse && (lastResponse.status === 400 || lastResponse.status === 422)) {
      throw new ProviderError('INVALID_PROVIDER_RESPONSE');
    }
    throw new ProviderError('PROVIDER_UNAVAILABLE');
  }
}
