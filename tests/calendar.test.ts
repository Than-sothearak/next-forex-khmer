import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, cambodiaDate, calendarPresets, calendarQuery, dayBounds, validDay, khmerDateLabel } from '../lib/calendar/dates';
import { demoEvents } from '../lib/calendar/demo';
import { normalizeEvents, retryDelay, utcTimestamp } from '../lib/calendar/providers/trading-economics-data';
const fixture = { CalendarId: 'unit-fixture', Event: 'Example event', Country: 'Canada', Currency: 'C$', Importance: 3, Date: '2026-10-09T17:30:00', DateSpan: '0', Actual: '0', Forecast: '', Previous: null };
test('Cambodia date boundaries include local midnight and exclude the next day', () => {
  const range = dayBounds('2026-10-09', '2026-10-09');
  assert.equal(range.from.toISOString(), '2026-10-08T17:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-10-09T17:00:00.000Z');
  assert.equal(cambodiaDate(new Date('2026-10-09T17:00:00Z')), '2026-10-10');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
test('query rejects invalid dates, long ranges, inverted ranges and unsafe filters', () => {
  assert.equal(validDay('2026-02-30'), false);
  for (const query of ['from=2026-02-30', 'from=2026-10-10&to=2026-10-09', 'from=2026-01-01&to=2026-03-01', 'currency=usd', 'country=%24ne', 'impact=critical']) assert.throws(() => calendarQuery(new URLSearchParams(query)));
  assert.doesNotThrow(() => calendarQuery(new URLSearchParams('from=2026-10-01&to=2026-10-31&currency=USD&impact=high')));
});
test('provider normalization preserves zero and missing values, normalizes symbols and UTC', () => {
  const [event] = normalizeEvents([fixture]);
  assert.equal(event.actual, '0'); assert.equal(event.forecast, null); assert.equal(event.currency, 'CAD');
  assert.equal(event.eventAt, '2026-10-09T17:30:00.000Z'); assert.equal(event.timeTentative, false);
  assert.equal(normalizeEvents([{ ...fixture, DateSpan: '1' }])[0].timeTentative, true);
  assert.equal(utcTimestamp('2026-10-09T19:30:00+07:00'), '2026-10-09T12:30:00.000Z');
});
test('bad or truncated provider payloads fail rather than produce fabricated data', () => {
  for (const payload of [{ error: 'bad' }, [null], [{ ...fixture, Importance: 9 }], [{ ...fixture, Date: '2026-02-30T10:00:00' }], [{ ...fixture, Event: '' }], Array(1000).fill(fixture)]) assert.throws(() => normalizeEvents(payload));
  assert.equal(normalizeEvents([{ ...fixture, SourceURL: 'javascript:alert(1)' }])[0].sourceUrl, null);
});
test('duplicate IDs retain the most recent revision', () => {
  const rows = normalizeEvents([{ ...fixture, LastUpdate: '2026-10-09T12:00:00', Actual: '1' }, { ...fixture, LastUpdate: '2026-10-09T11:00:00', Actual: '2' }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].actual, '1');
});
test('rate-limit delays support seconds and HTTP dates without ignoring long backoff', () => {
  const now = Date.parse('2026-10-09T00:00:00Z');
  assert.equal(retryDelay('7200', now), 7200);
  assert.equal(retryDelay('Fri, 09 Oct 2026 00:10:00 GMT', now), 600);
  assert.equal(retryDelay('garbage'), 300);
});
test('demo fixtures are clearly identified and contain no market values', () => {
  const events = demoEvents('2026-10-09');
  assert.equal(events.length, 42);
  assert.ok(events.every(event => event.provider === 'demo' && event.source.includes('Demo') && event.actual === null && event.forecast === null && event.previous === null));
});

test('Khmer date labels do not depend on browser ICU locale support', () => {
  assert.equal(khmerDateLabel('2026-10-09'), 'ថ្ងៃសុក្រ ទី៩ តុលា ២០២៦');
});

test('historical presets use complete weeks and months across year and leap-day boundaries', () => {
  const cases = [
    ['2026-10-09', '2026-10-08', '2026-09-28', '2026-10-04', '2026-09-01', '2026-09-30'],
    ['2026-01-01', '2025-12-31', '2025-12-22', '2025-12-28', '2025-12-01', '2025-12-31'],
    ['2024-03-01', '2024-02-29', '2024-02-19', '2024-02-25', '2024-02-01', '2024-02-29'],
    ['2026-10-05', '2026-10-04', '2026-09-28', '2026-10-04', '2026-09-01', '2026-09-30'],
    ['2026-10-11', '2026-10-10', '2026-09-28', '2026-10-04', '2026-09-01', '2026-09-30'],
  ];
  for (const [today, yesterday, weekFrom, weekTo, monthFrom, monthTo] of cases) {
    const presets = calendarPresets(today);
    const range = (id: string) => {
      const preset = presets.find(item => item.id === id)!;
      return [preset.from, preset.to];
    };
    assert.deepEqual(range('yesterday'), [yesterday, yesterday]);
    assert.deepEqual(range('last-week'), [weekFrom, weekTo]);
    assert.deepEqual(range('last-month'), [monthFrom, monthTo]);
    for (const preset of presets) assert.doesNotThrow(() => dayBounds(preset.from, preset.to));
  }
});
