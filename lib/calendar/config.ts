import "server-only";
import {
  APIFY_ACTOR_URL,
  apifySourceNames,
  type ApifySource,
} from "./providers/apify-data";
export function calendarConfig() {
  const selection = process.env.ECONOMIC_CALENDAR_PROVIDER || "demo";
  const apifySource = process.env.APIFY_CALENDAR_SOURCE;
  const validApifySource =
    apifySource === "forexfactory" ||
    apifySource === "fxstreet" ||
    apifySource === "pintostudio";
  const permission =
    apifySource === "forexfactory"
      ? process.env.APIFY_FOREXFACTORY_PERMISSION_CONFIRMED === "true"
      : apifySource === "fxstreet"
        ? process.env.APIFY_FXSTREET_PERMISSION_CONFIRMED === "true"
        : apifySource === "pintostudio" &&
          process.env.APIFY_PINTOSTUDIO_PERMISSION_CONFIRMED === "true";
  const apify = selection === "apify";
  const provider =
    apify && validApifySource ? `apify-${apifySource}` : selection;
  const interval = Number(
    process.env.CALENDAR_SYNC_INTERVAL_MINUTES || (apify ? 60 : 15),
  );
  return {
    provider,
    apifySource: validApifySource ? (apifySource as ApifySource) : null,
    enabled: apify
      ? validApifySource && !!process.env.APIFY_API_TOKEN && permission
      : selection === "trading-economics" &&
        !!process.env.TRADING_ECONOMICS_API_KEY &&
        process.env.CALENDAR_REDISTRIBUTION_LICENSE_CONFIRMED === "true",
    sourceName:
      apify && validApifySource
        ? `Apify · ${apifySourceNames[apifySource]}`
        : "Trading Economics",
    sourceUrl: apify
      ? APIFY_ACTOR_URL
      : "https://tradingeconomics.com/calendar",
    syncIntervalMinutes: Number.isFinite(interval)
      ? Math.max(5, Math.min(1440, interval))
      : apify
        ? 60
        : 15,
  };
}
