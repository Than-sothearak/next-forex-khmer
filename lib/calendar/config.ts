import "server-only";
import { APIFY_ACTOR_URL } from "./providers/apify-data";
export function calendarConfig() {
  const source = process.env.APIFY_CALENDAR_SOURCE;
  const validSource = source === "xtracto/forexfactory-calendar";
  const interval = Number(process.env.CALENDAR_SYNC_INTERVAL_MINUTES || 60);
  return {
    provider: validSource ? "apify-forexfactory" : "demo",
    enabled: validSource && Boolean(process.env.APIFY_API_TOKEN),
    sourceName: "Apify - Forex Factory",
    sourceUrl: APIFY_ACTOR_URL,
    syncIntervalMinutes: Number.isFinite(interval)
      ? Math.max(5, Math.min(1440, interval))
      : 60,
  };
}
