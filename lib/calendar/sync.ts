import "server-only";
import { randomUUID } from "node:crypto";
import { connectMongo } from "@/lib/mongodb";
import { getCalendarProvider } from "@/lib/calendar-provider";
import EconomicEvent from "@/models/EconomicEvent";
import CalendarSync from "@/models/CalendarSync";
import Translation from "@/models/Translation";
import { addDays, cambodiaDate, dayBounds } from "./dates";
import { calendarConfig } from "./config";
import { ProviderError } from "./providers/trading-economics-data";
import { translateCalendarBatch } from "./translations";

export async function syncCalendar() {
  const config = calendarConfig();
  const provider = getCalendarProvider();
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
  if (!lease)
    return {
      status: "skipped",
      reason:
        "A sync is running or the refresh/backoff interval has not elapsed.",
    };
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
    // Reconcile cancellations only in the successfully fetched window.
    await EconomicEvent.deleteMany({
      provider: provider.id,
      eventAt: { $gte: range.from, $lt: range.to },
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
    await CalendarSync.updateOne(
      { _id: provider.id, lockToken: token },
      {
        $set: {
          translationPending,
          nextAttemptAt: new Date(
            Date.now() + config.syncIntervalMinutes * 60_000,
          ),
          lockUntil: new Date(0),
        },
      },
    );
    return {
      status: "synced",
      events: events.length,
      lastUpdated: syncedAt.toISOString(),
      translationPending,
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
