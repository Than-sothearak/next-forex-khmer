import 'server-only';
import { ApifyCalendarProvider } from './calendar/providers/apify';
import type { CalendarEvent } from './calendar/types';
import { calendarConfig } from './calendar/config';
import { normalizeEvents, ProviderError, retryDelay } from './calendar/providers/trading-economics-data';
export interface CalendarProvider {
  id: string;
  name: string;
  url: string;
  getEvents(from: Date, to: Date): Promise<CalendarEvent[]>;
}
export class TradingEconomicsProvider implements CalendarProvider {
  id = 'trading-economics';
  name = 'Trading Economics';
  url = 'https://tradingeconomics.com/calendar';
  async getEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    const url = new URL(`https://api.tradingeconomics.com/calendar/country/All/${from.toISOString().slice(0, 10)}/${new Date(to.getTime() - 1).toISOString().slice(0, 10)}`);
    url.searchParams.set('c', process.env.TRADING_ECONOMICS_API_KEY!);
    url.searchParams.set('f', 'json');
    let response: Response;
    try { response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(25_000), redirect: 'error' }); }
    catch { throw new ProviderError('PROVIDER_UNAVAILABLE'); }
    if (response.status === 429) throw new ProviderError('PROVIDER_RATE_LIMIT', retryDelay(response.headers.get('retry-after')));
    if (!response.ok) throw new ProviderError(response.status === 401 || response.status === 403 ? 'PROVIDER_AUTHORIZATION' : 'PROVIDER_UNAVAILABLE');
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new ProviderError('INVALID_PROVIDER_RESPONSE'); }
    return normalizeEvents(payload).filter(event => new Date(event.eventAt) >= from && new Date(event.eventAt) < to);
  }
}
export function getCalendarProvider(): CalendarProvider {
  const config = calendarConfig();
  if (!config.enabled) throw new ProviderError('PROVIDER_NOT_CONFIGURED');
  return config.apifySource && config.provider.startsWith('apify-')
    ? new ApifyCalendarProvider(config.apifySource)
    : new TradingEconomicsProvider();
}
