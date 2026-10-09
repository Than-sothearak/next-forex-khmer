import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { normalizeApifyEvents } from '../lib/calendar/providers/apify-data';
import { ApifyCalendarProvider } from '../lib/calendar/providers/apify';
import { calendarConfig } from '../lib/calendar/config';
import { getCalendarProvider } from '../lib/calendar-provider';
import { GET } from '../app/api/calendar/route';
import { POST } from '../app/api/calendar/sync/route';

// Authored fixture: never downloaded from Forex Factory or FXStreet.
const fixture = {
  title: 'Example release', country: 'USD', impact: 'high',
  date_iso: '2026-10-09T08:30:00-04:00', actual: 0, forecast: null, previous: '',
  canonical_event_id: 'USD_EXAMPLE', data_source: 'forexfactory',
};

test('Apify normalizes offset times and ignores the Actor summary row', () => {
  const { data_source: _source, ...currentActorRow } = fixture;
  const [event] = normalizeApifyEvents([{ ...currentActorRow, _record_type: 'event' }, {
    _record_type: 'week_outlook', title: 'Week outlook', date_iso: '2026-10-09T00:00:00Z',
  }], 'forexfactory');
  assert.equal(event.provider, 'apify-forexfactory');
  assert.equal(event.eventAt, '2026-10-09T12:30:00.000Z');
  assert.equal(event.country, 'United States'); assert.equal(event.currency, 'USD');
  assert.equal(event.actual, '0'); assert.equal(event.forecast, null); assert.equal(event.previous, null);
  assert.equal(event.descriptionEn, null); assert.equal(event.providerUpdatedAt, null);
  const [fxstreet] = normalizeApifyEvents([{ ...fixture, country: 'KR', data_source: 'fxstreet' }], 'fxstreet');
  assert.equal(fxstreet.country, 'South Korea'); assert.equal(fxstreet.currency, 'KRW');
});
test('Apify deduplicates repeated rows but keeps recurring occurrences distinct', () => {
  const events = normalizeApifyEvents([fixture, fixture, { ...fixture, date_iso: '2026-11-09T08:30:00-05:00' }], 'forexfactory');
  assert.equal(events.length, 2); assert.notEqual(events[0].providerId, events[1].providerId);
  assert.equal(events[0].providerId, normalizeApifyEvents([{ ...fixture, actual: '2' }], 'forexfactory')[0].providerId);
  assert.throws(() => normalizeApifyEvents([fixture, { ...fixture, actual: '2' }], 'forexfactory'), /APIFY_CONFLICTING_EVENTS/);
});
test('Apify refuses unauthorized sources, uncertain timestamps, truncation and empty output', () => {
  assert.throws(() => normalizeApifyEvents([fixture], 'fxstreet'), /APIFY_UNEXPECTED_SOURCE/);
  for (const payload of [[], [{ type: 'week_outlook' }], { error: 'failed' }, [null], [{ ...fixture, date_iso: '2026-10-09T08:30:00' }], [{ ...fixture, date_iso: '2026-02-30T08:30:00Z' }], [{ ...fixture, actual: {} }], [{ ...fixture, impact: 'holiday' }], Array(500).fill(fixture)]) {
    assert.throws(() => normalizeApifyEvents(payload, 'forexfactory'));
  }
});
test('Apify accepts Pintostudio and points at the correct actor endpoint', async () => {
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;
  process.env.ECONOMIC_CALENDAR_PROVIDER = 'apify';
  process.env.APIFY_API_TOKEN = 'fixture-only-token';
  process.env.APIFY_CALENDAR_SOURCE = 'pintostudio';
  process.env.APIFY_PINTOSTUDIO_PERMISSION_CONFIRMED = 'true';
  process.env.APIFY_FOREXFACTORY_PERMISSION_CONFIRMED = 'false';
  process.env.APIFY_FXSTREET_PERMISSION_CONFIRMED = 'false';
  process.env.CALENDAR_SYNC_SECRET = 'fixture-only-secret-at-least-32-characters';
  delete process.env.CALENDAR_SYNC_INTERVAL_MINUTES;

  const from = new Date('2026-10-08T17:00:00Z');
  const to = new Date('2026-10-09T17:00:00Z');
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'api.apify.com');
    assert.equal(url.pathname, '/v2/actors/pintostudio~economic-calendar-data-investing-com/run-sync-get-dataset-items');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.dateFrom, '2026-10-07');
    assert.equal(body.dateTo, '2026-10-10');
    return Response.json([{ ...fixture, data_source: 'pintostudio' }], { status: 200 });
  };

  try {
    assert.equal(calendarConfig().provider, 'apify-pintostudio');
    assert.equal(calendarConfig().enabled, true);
    const provider = getCalendarProvider();
    const events = await provider.getEvents(from, to);
    assert.equal(events.length, 1);
    assert.equal(events[0].provider, 'apify-pintostudio');
  } finally {
    globalThis.fetch = originalFetch;
    process.env = env;
  }
});
test('Apify adapter is gated, uses bearer auth, bounds requests and preserves failures', async t => {
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let status = 200;
  let payload: unknown = [fixture];
  process.env.ECONOMIC_CALENDAR_PROVIDER = 'apify';
  process.env.APIFY_API_TOKEN = 'fixture-only-token';
  process.env.APIFY_CALENDAR_SOURCE = 'forexfactory';
  process.env.APIFY_FOREXFACTORY_PERMISSION_CONFIRMED = 'false';
  process.env.APIFY_FXSTREET_PERMISSION_CONFIRMED = 'false';
  process.env.CALENDAR_SYNC_SECRET = 'fixture-only-secret-at-least-32-characters';
  delete process.env.CALENDAR_SYNC_INTERVAL_MINUTES;
  const from = new Date('2026-10-08T17:00:00Z');
  const to = new Date('2026-10-09T17:00:00Z');
  globalThis.fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.hostname, 'api.apify.com');
    assert.equal(url.pathname, '/v2/actors/gochujang~economic-calendar-tracker/run-sync-get-dataset-items');
    assert.equal(url.searchParams.has('token'), false);
    assert.equal(url.searchParams.get('timeout'), '120');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer fixture-only-token');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.source, 'forexfactory'); assert.equal(body.limit, 500);
    assert.equal(body.excludeHolidays, true); assert.deepEqual(body.impactLevels, ['high', 'medium', 'low']);
    assert.equal(body.telegramBotToken, undefined); assert.equal(body.webhookUrl, undefined);
    assert.equal(body.dateFrom, '2026-10-07'); assert.equal(body.dateTo, '2026-10-10');
    return Response.json(payload, { status, headers: { 'Retry-After': '7200' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; process.env = env; });

  assert.equal(calendarConfig().enabled, false);
  assert.throws(() => getCalendarProvider(), /PROVIDER_NOT_CONFIGURED/);
  await assert.rejects(new ApifyCalendarProvider('forexfactory').getEvents(from, to), /PROVIDER_NOT_CONFIGURED/);
  const publicResponse = await GET(new NextRequest('http://localhost/api/calendar?from=2026-10-09&to=2026-10-09'));
  assert.equal((await publicResponse.json()).meta.mode, 'demo');
  const syncResponse = await POST(new NextRequest('http://localhost/api/calendar/sync', { method: 'POST', headers: { Authorization: `Bearer ${process.env.CALENDAR_SYNC_SECRET}` } }));
  assert.equal(syncResponse.status, 503); assert.equal(calls, 0);

  process.env.APIFY_FOREXFACTORY_PERMISSION_CONFIRMED = 'true';
  assert.equal(calendarConfig().syncIntervalMinutes, 60);
  assert.equal(calendarConfig().sourceName, 'Apify · Forex Factory');
  const provider = getCalendarProvider();
  const events = await provider.getEvents(from, to); assert.equal(events.length, 1);
  payload = [{ ...fixture, date_iso: '2026-10-10T08:30:00-04:00' }];
  assert.equal((await provider.getEvents(from, to)).length, 0);
  payload = { error: 'placeholder' }; status = 429;
  await assert.rejects(provider.getEvents(from, to), error => (error as { retryAfterSeconds: number }).retryAfterSeconds === 7200);
  status = 401; await assert.rejects(provider.getEvents(from, to), /PROVIDER_AUTHORIZATION/);
  status = 408; await assert.rejects(provider.getEvents(from, to), /PROVIDER_UNAVAILABLE/);
  status = 200; await assert.rejects(provider.getEvents(from, to), /INVALID_PROVIDER_RESPONSE/);

  const before = calls;
  process.env.APIFY_CALENDAR_SOURCE = 'fxstreet';
  assert.equal(calendarConfig().enabled, false); // Permission for one source cannot enable another.
  process.env.APIFY_FXSTREET_PERMISSION_CONFIRMED = 'true';
  assert.equal(calendarConfig().provider, 'apify-fxstreet');
  await assert.rejects(provider.getEvents(from, to), /PROVIDER_NOT_CONFIGURED/);
  assert.equal(calls, before);
  delete process.env.APIFY_API_TOKEN;
  assert.equal(calendarConfig().enabled, false);
  process.env.APIFY_API_TOKEN = 'fixture-only-token';
  process.env.APIFY_CALENDAR_SOURCE = 'both';
  assert.equal(calendarConfig().enabled, false);
});
