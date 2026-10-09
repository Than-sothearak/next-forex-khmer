import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { syncCalendar } from "../lib/calendar/sync";
import { GET } from "../app/api/calendar/route";
import { POST } from "../app/api/calendar/sync/route";
import EconomicEvent from "../models/EconomicEvent";
import CalendarSync from "../models/CalendarSync";
import Translation from "../models/Translation";
import { cambodiaDate } from "../lib/calendar/dates";

test(
  "calendar sync caches Apify events and preserves them when a refresh fails",
  { skip: !process.env.TEST_MONGODB_URI },
  async (t) => {
    const uri = new URL(process.env.TEST_MONGODB_URI!);
    uri.pathname = `/forex_calendar_test_${process.pid}_${Date.now()}`;
    process.env.MONGODB_URI = uri.toString();
    process.env.APIFY_CALENDAR_SOURCE = "xtracto/forexfactory-calendar";
    process.env.APIFY_API_TOKEN = "test-placeholder";
    process.env.CALENDAR_SYNC_SECRET = "test-secret-that-is-at-least-32-characters";
    process.env.OPENAI_API_KEY = "test-placeholder";

    const originalFetch = globalThis.fetch;
    const today = cambodiaDate();
    const event = {
      event: "Example release",
      country: "USD",
      currency: "USD",
      impact: "high",
      date_iso: `${today}T12:30:00+07:00`,
      actual: "0",
      forecast: "1.0",
      previous: "0.8",
      canonical_event_id: "integration-example",
      data_source: "forexfactory",
    };
    let providerCalls = 0;
    let mode: "success" | "rate-limit" | "invalid" | "empty" = "success";

    globalThis.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith("https://api.apify.com/")) {
        providerCalls++;
        if (mode === "rate-limit")
          return new Response("{}", {
            status: 429,
            headers: { "retry-after": "3600" },
          });
        if (mode === "invalid") return Response.json({ unexpected: true });
        if (mode === "empty") return Response.json([]);
        return Response.json([event, event]);
      }
      if (url.startsWith("https://api.openai.com/")) {
        const body = JSON.parse(
          String(init?.body || (input instanceof Request ? await input.text() : "{}")),
        );
        const texts = JSON.parse(body.messages[1].content) as string[];
        return Response.json({
          id: "test",
          object: "chat.completion",
          created: 0,
          model: "gpt-4o-mini",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: JSON.stringify({ translations: texts.map(() => "ឧទាហរណ៍") }),
              },
            },
          ],
        });
      }
      throw new Error("Unexpected outbound request in isolated test");
    };

    const providerId = "apify-forexfactory";
    const unlock = () =>
      CalendarSync.updateOne(
        { _id: providerId },
        { $set: { nextAttemptAt: new Date(0), lockUntil: new Date(0) } },
      );
    const read = () =>
      GET(
        new NextRequest(
          `http://localhost/api/calendar?from=${today}&to=${today}`,
        ),
      );

    try {
      await t.test("sync stores events and the public route returns cached data", async () => {
        const result = await syncCalendar();
        assert.equal(result.status, "synced");
        assert.equal(await EconomicEvent.countDocuments(), 1);
        assert.equal(await Translation.countDocuments(), 1);
        const response = await read();
        const body = await response.json();
        assert.equal(body.meta.mode, "provider");
        assert.equal(body.events[0].actual, "0");
        assert.ok(!JSON.stringify(body).includes("test-placeholder"));
      });

      await t.test("refresh cooldown avoids another paid Actor run", async () => {
        assert.equal((await syncCalendar()).status, "skipped");
        assert.equal(providerCalls, 1);
      });

      await t.test("rate limit preserves cached events and applies backoff", async () => {
        await unlock();
        mode = "rate-limit";
        await assert.rejects(syncCalendar(), /PROVIDER_RATE_LIMIT/);
        assert.equal(await EconomicEvent.countDocuments(), 1);
        const state = await CalendarSync.findById(providerId).lean();
        assert.ok(state!.nextAttemptAt.getTime() - Date.now() > 3_590_000);
      });

      await t.test("empty and invalid actor responses preserve the cache", async () => {
        for (const responseMode of ["invalid", "empty"] as const) {
          await unlock();
          mode = responseMode;
          await assert.rejects(syncCalendar());
          assert.equal(await EconomicEvent.countDocuments(), 1);
        }
      });

      await t.test("sync route requires its bearer secret", async () => {
        const response = await POST(
          new NextRequest("http://localhost/api/calendar/sync", {
            method: "POST",
          }),
        );
        assert.equal(response.status, 401);
      });
    } finally {
      globalThis.fetch = originalFetch;
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
