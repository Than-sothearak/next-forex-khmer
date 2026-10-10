export async function register() {
  // Keep the Node-only dependency graph inside this literal runtime branch.
  // Next also compiles instrumentation for Edge, which cannot load node:crypto.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;

    if (process.env.CALENDAR_AUTO_SYNC !== "true") {
      console.info("[calendar-auto-sync] not started", {
        reason: "CALENDAR_AUTO_SYNC is not true; use the sync endpoint or enable automatic sync.",
      });
      return;
    }

    if (process.env.VERCEL) {
      console.warn("[calendar-auto-sync] not started", {
        reason: "Vercel does not keep background timers running; configure an external scheduler to call /api/calendar/sync.",
      });
      return;
    }
    if (process.env.APIFY_CALENDAR_SOURCE !== "xtracto/forexfactory-calendar" || !process.env.APIFY_API_TOKEN) {
      console.warn("[calendar-auto-sync] not started", {
        reason: "Configure APIFY_CALENDAR_SOURCE and APIFY_API_TOKEN to enable provider sync.",
        sourceConfigured: process.env.APIFY_CALENDAR_SOURCE === "xtracto/forexfactory-calendar",
        tokenConfigured: Boolean(process.env.APIFY_API_TOKEN),
      });
      return;
    }
    const { startCalendarAutoSync } = await import("./lib/calendar/auto-sync");
    startCalendarAutoSync();
  }
}
