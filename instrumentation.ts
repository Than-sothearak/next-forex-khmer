export async function register() {
  // Keep the Node-only dependency graph inside this literal runtime branch.
  // Next also compiles instrumentation for Edge, which cannot load node:crypto.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.CALENDAR_AUTO_SYNC !== "true"
    ) return;

    if (process.env.VERCEL) {
      console.warn("[calendar-auto-sync] Use an external scheduler on Vercel; background timers require a continuously running Node server.");
      return;
    }
    const { startCalendarAutoSync } = await import("./lib/calendar/auto-sync");
    startCalendarAutoSync();
  }
}
