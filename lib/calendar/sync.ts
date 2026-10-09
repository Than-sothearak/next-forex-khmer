import "server-only";
import { randomUUID } from "node:crypto";
import { connectMongo } from "@/lib/mongodb";
import EconomicEvent from "@/models/EconomicEvent";
import CalendarSync from "@/models/CalendarSync";
import Translation from "@/models/Translation";
import {
  addDays,
  cambodiaDate,
  dayBounds,
  formatCambodiaDate,
} from "./dates";
import { calendarConfig } from "./config";
import { ApifyCalendarProvider } from "./providers/apify";
import { ProviderError } from "./providers/provider-utils";
import { translateCalendarBatch } from "./translations";

export async function syncCalendar() {
  const config = calendarConfig();
  if (!config.enabled) throw new ProviderError("PROVIDER_NOT_CONFIGURED");
  const provider = new ApifyCalendarProvider();
  await connectMongo();
  await Promise.all([
    EconomicEvent.init(),
    CalendarSync.init(),
    Translation.init(),
  ]);
  // The unique _id and atomic lease coordinate scheduled requests across instances.
  try {
    await CalendarSync.updateOne(
      { _id: provider.id },
      { $setOnInsert: { lockUntil: new Date(0), nextAttemptAt: new Date(0) } },
      { upsert: true },
    );
  } catch (error) {
    // Another process may create the first state document at the same instant.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const now = new Date();
  const token = randomUUID();
  const lease = await CalendarSync.findOneAndUpdate(
    {
      _id: provider.id,
      lockUntil: { $lte: now },
      nextAttemptAt: { $lte: now },
    },
    {
      $set: { lockToken: token, lockUntil: new Date(now.getTime() + 300_000) },
    },
    { new: true },
  ).lean();
  if (!lease) {
    const current = await CalendarSync.findById(provider.id).lean();
    return {
      status: "skipped",
      nextAttemptAt: current?.nextAttemptAt?.toISOString(),
      reason:
        "A sync is running or the refresh/backoff interval has not elapsed.",
    };
  }
  const today = cambodiaDate();
  const range = dayBounds(addDays(today, -1), addDays(today, 7));
  try {
    const events = await provider.getEvents(range.from, range.to);
    // Fetch and validate the complete response before touching cached events.
    const syncedAt = new Date();
    if (events.length)
      await EconomicEvent.bulkWrite(
        events.map(
          ({ titleKm: _title, descriptionKm: _description, ...event }) => ({
            updateOne: {
              filter: { provider: provider.id, providerId: event.providerId },
              update: {
                $set: {
                  ...event,
                  eventAt: new Date(event.eventAt),
                  providerUpdatedAt: event.providerUpdatedAt
                    ? new Date(event.providerUpdatedAt)
                    : null,
                  syncedAt,
                },
              },
              upsert: true,
            },
          }),
        ),
      );
    // Apify may omit past releases even when the requested window includes them.
    // Preserve our historical archive; reconcile omissions from today onward.
    const reconcileFrom = dayBounds(today, today).from;
    await EconomicEvent.deleteMany({
      provider: provider.id,
      eventAt: { $gte: reconcileFrom, $lt: range.to },
      providerId: { $nin: events.map((event) => event.providerId) },
    });
    await CalendarSync.updateOne(
      { _id: provider.id, lockToken: token },
      {
        $set: {
          lastSuccess: syncedAt,
          coverageFrom: range.from,
          coverageTo: range.to,
          lastError: null,
          translationPending: true,
        },
      },
    );
    const translationResult = await translateCalendarBatch(
      provider.id,
      events.flatMap((event) => [event.titleEn, event.descriptionEn || ""]),
    );
    const translationPending = translationResult.pending;
    const completedAt = Date.now();
    const regularAttemptAt = completedAt + config.syncIntervalMinutes * 60_000;
    // Schedule from the request start: a release during a slow Actor run may
    // still be absent from that run's snapshot. Group simultaneous releases.
    const releaseAttempts = events
      .filter(event => !event.timeTentative && event.actual === null)
      .map(event => new Date(event.eventAt).getTime() + 15_000)
      .filter(at => Number.isFinite(at) && at > now.getTime());
    const nextAttemptAt = new Date(Math.max(
      completedAt + 15_000,
      Math.min(regularAttemptAt, ...releaseAttempts),
    ));
    console.info('[calendar-sync] next request scheduled', {
      nextAttemptAt: formatCambodiaDate(nextAttemptAt),
      reason: nextAttemptAt.getTime() < regularAttemptAt ? 'event-release' : 'regular-interval',
    });
    await CalendarSync.updateOne(
      { _id: provider.id, lockToken: token },
      {
        $set: {
          translationPending,
          nextAttemptAt,
          lockUntil: new Date(0),
        },
      },
    );
    return {
      status: "synced",
      events: events.length,
      lastUpdated: syncedAt.toISOString(),
      translationPending,
      nextAttemptAt: nextAttemptAt.toISOString(),
    };
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "SYNC_FAILED";
    const backoff =
      error instanceof ProviderError ? error.retryAfterSeconds : 300;
    await CalendarSync.updateOne(
      { _id: provider.id, lockToken: token },
      {
        $set: {
          // A failed first sync should retry after provider backoff, not wait the
          // full successful-refresh interval (which may be an hour for Apify).
          lastError: code,
          nextAttemptAt: new Date(Date.now() + Math.max(backoff, 30) * 1000),
          lockUntil: new Date(0),
        },
      },
    );
    throw new ProviderError(code, backoff);
  }
}
