import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, cambodiaDate, calendarPresets, calendarQuery, dayBounds, validDay, khmerDateLabel } from '../lib/calendar/dates';
import { demoEvents } from '../lib/calendar/demo';
import { retryDelay, utcTimestamp } from '../lib/calendar/providers/provider-utils';
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
test('provider timestamps are validated and normalized to UTC', () => {
  assert.equal(utcTimestamp('2026-10-09T19:30:00+07:00'), '2026-10-09T12:30:00.000Z');
  for (const invalid of [
    '2026-02-30T10:00:00Z',
    '2026-10-09T25:00:00Z',
    'not-a-date',
  ]) assert.throws(() => utcTimestamp(invalid));
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

test('date presets only include the current short ranges', () => {
  const presets = calendarPresets('2026-10-09');
  assert.deepEqual(presets.map(({ id }) => id), [
    'yesterday',
    'today',
    'tomorrow',
    'next-seven-days',
  ]);
  for (const preset of presets)
    assert.doesNotThrow(() => dayBounds(preset.from, preset.to));
});
