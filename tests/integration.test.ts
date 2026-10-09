import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { syncCalendar } from '../lib/calendar/sync';
import { GET } from '../app/api/calendar/route';
import { POST } from '../app/api/calendar/sync/route';
import EconomicEvent from '../models/EconomicEvent';
import CalendarSync from '../models/CalendarSync';
import Translation from '../models/Translation';
import { cambodiaDate } from '../lib/calendar/dates';

test('MongoDB calendar sync, translation cache, and failure recovery', { skip: !process.env.TEST_MONGODB_URI }, async t => {
  // Create a unique test database; never drop or modify the supplied database itself.
  const uri = new URL(process.env.TEST_MONGODB_URI!);
  uri.pathname = `/forex_calendar_test_${process.pid}_${Date.now()}`;
  process.env.MONGODB_URI = uri.toString();
  process.env.ECONOMIC_CALENDAR_PROVIDER = 'trading-economics';
  process.env.TRADING_ECONOMICS_API_KEY = 'test-placeholder';
  process.env.CALENDAR_REDISTRIBUTION_LICENSE_CONFIRMED = 'true';
  process.env.CALENDAR_SYNC_SECRET = 'test-secret-that-is-at-least-32-characters';
  process.env.OPENAI_API_KEY = 'test-placeholder';
  const originalFetch = globalThis.fetch;
  let providerCalls = 0, aiCalls = 0, mode = 'success';
  let actual = '0';
  const today = cambodiaDate();
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('https://api.tradingeconomics.com/')) {
      providerCalls++;
      if (mode === 'limited') return new Response('{}', { status: 429, headers: { 'retry-after': '3600' } });
      if (mode === 'invalid') return Response.json({ unexpected: 'payload' });
      if (mode === 'empty') return Response.json([]);
      const event = { CalendarId: 'integration-example', Event: 'Example event', Description: 'An example description.', Country: 'United States', Currency: 'USD', Date: `${today}T12:30:00`, Importance: 3, DateSpan: '0', Actual: actual, Forecast: '', Previous: null };
      return Response.json([event, event]);
    }
    if (url.startsWith('https://api.openai.com/')) {
      aiCalls++;
      const body = JSON.parse(String(init?.body || (input instanceof Request ? await input.text() : '{}')));
      const texts = JSON.parse(body.messages[1].content) as string[];
      return Response.json({ id: 'test', object: 'chat.completion', created: 0, model: 'gpt-4o-mini', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ translations: texts.map((_, i) => i === 0 ? 'ព្រឹត្តិការណ៍ឧទាហរណ៍' : 'ការពិពណ៌នាឧទាហរណ៍') }) } }] });
    }
    throw new Error('Unexpected outbound request in isolated test');
  };
  async function unlock() { await CalendarSync.updateOne({ _id: 'trading-economics' }, { $set: { nextAttemptAt: new Date(0), lockUntil: new Date(0) } }); }
  async function read() { return GET(new NextRequest(`http://localhost/api/calendar?from=${today}&to=${today}`)); }
  try {
    await t.test('first sync deduplicates and caches Khmer; public response omits credentials', async () => {
      const result = await syncCalendar(); assert.equal(result.status, 'synced');
      assert.equal(await EconomicEvent.countDocuments(), 1); assert.equal(await Translation.countDocuments(), 2);
      const response = await read(); assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.events[0].actual, '0'); assert.equal(body.events[0].titleKm, 'ព្រឹត្តិការណ៍ឧទាហរណ៍');
      assert.equal(body.meta.mode, 'provider'); assert.equal(body.meta.stale, false);
      assert.ok(!JSON.stringify(body).includes('test-placeholder'));
    });
    await t.test('refresh interval prevents repeat calls and unchanged text reuses translations', async () => {
      assert.equal((await syncCalendar()).status, 'skipped'); assert.equal(providerCalls, 1);
      await unlock(); actual = '2'; await syncCalendar();
      assert.equal(await EconomicEvent.countDocuments(), 1); assert.equal(aiCalls, 1);
      assert.equal((await (await read()).json()).events[0].actual, '2');
    });
    await t.test('concurrent syncs acquire only one lease', async () => {
      await unlock(); const before = providerCalls;
      const results = await Promise.all([syncCalendar(), syncCalendar()]);
      assert.equal(providerCalls, before + 1); assert.equal(results.filter(result => result.status === 'skipped').length, 1);
    });
    await t.test('rate limit preserves cache and honors Retry-After', async () => {
      await unlock(); mode = 'limited'; await assert.rejects(syncCalendar(), /PROVIDER_RATE_LIMIT/);
      assert.equal(await EconomicEvent.countDocuments(), 1);
      const state = await CalendarSync.findById('trading-economics').lean();
      assert.ok(state!.nextAttemptAt.getTime() - Date.now() > 3_590_000);
      assert.equal((await (await read()).json()).meta.warning, 'PROVIDER_ERROR');
      const before = providerCalls; assert.equal((await syncCalendar()).status, 'skipped'); assert.equal(providerCalls, before);
    });
    await t.test('malformed responses preserve events; successful empty response reconciles cancellations', async () => {
      await unlock(); mode = 'invalid'; await assert.rejects(syncCalendar(), /INVALID_PROVIDER_RESPONSE/);
      assert.equal(await EconomicEvent.countDocuments(), 1);
      await unlock(); mode = 'empty'; await syncCalendar();
      assert.equal(await EconomicEvent.countDocuments(), 0);
    });
    await t.test('sync requires a secret; missing license returns demo without provider access', async () => {
      assert.equal((await POST(new NextRequest('http://localhost/api/calendar/sync', { method: 'POST' }))).status, 401);
      process.env.CALENDAR_REDISTRIBUTION_LICENSE_CONFIRMED = 'false';
      const before = providerCalls; const response = await read();
      assert.equal((await response.json()).meta.mode, 'demo'); assert.equal(providerCalls, before);
      const sync = await POST(new NextRequest('http://localhost/api/calendar/sync', { method: 'POST', headers: { Authorization: `Bearer ${process.env.CALENDAR_SYNC_SECRET}` } }));
      assert.equal(sync.status, 503);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
