import test from "node:test";
import assert from "node:assert/strict";
import { normalizeApifyEvents } from "../lib/calendar/providers/apify-data";
import { ApifyCalendarProvider } from "../lib/calendar/providers/apify";
import { calendarConfig } from "../lib/calendar/config";

const fixture = {
  event: "Example release",
  currency: "USD",
  impact: "high",
  date_iso: "2026-10-09T08:30:00-04:00",
  actual: 0,
  forecast: null,
  previous: "",
  canonical_event_id: "USD_EXAMPLE",
  data_source: "forexfactory",
};

test("normalizes Forex Factory events and ignores the weekly summary", () => {
  const [event] = normalizeApifyEvents([
    fixture,
    { type: "week_outlook", title: "Week outlook" },
  ]);

  assert.equal(event.provider, "apify-forexfactory");
  assert.equal(event.eventAt, "2026-10-09T12:30:00.000Z");
  assert.equal(event.country, "United States");
  assert.equal(event.actual, "0");
  assert.equal(event.forecast, null);
});

test("rejects invalid rows and mismatched actor sources", () => {
  for (const payload of [
    [],
    { error: "failed" },
    [null],
    [{ ...fixture, data_source: "fxstreet" }],
    [{ ...fixture, date_iso: "2026-02-30T08:30:00Z" }],
    [{ ...fixture, actual: {} }],
  ]) {
    assert.throws(() => normalizeApifyEvents(payload));
  }
});

test("uses the configured Xtracto actor and bearer token", async (t) => {
  const previousEnv = { ...process.env };
  const previousFetch = globalThis.fetch;
  process.env.APIFY_CALENDAR_SOURCE = "xtracto/forexfactory-calendar";
  process.env.APIFY_API_TOKEN = "fixture-token";
  delete process.env.CALENDAR_SYNC_INTERVAL_MINUTES;

  const from = new Date("2026-10-08T17:00:00Z");
  const to = new Date("2026-10-09T17:00:00Z");
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(
      url.pathname,
      "/v2/actors/xtracto~forexfactory-calendar/run-sync-get-dataset-items",
    );
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer fixture-token",
    );
    const body = JSON.parse(String(init?.body));
    assert.equal(body.rangeFrom, "2026-10-08");
    assert.equal(body.rangeTo, "2026-10-09");
    return Response.json([fixture]);
  };

  t.after(() => {
    globalThis.fetch = previousFetch;
    process.env = previousEnv;
  });

  assert.equal(calendarConfig().enabled, true);
  const events = await new ApifyCalendarProvider().getEvents(from, to);
  assert.equal(events.length, 1);
});
