import "server-only";
import { calendarConfig } from "./config";
import { syncCalendar } from "./sync";
import { formatCambodiaDate } from "./dates";
import { ProviderError } from "./providers/provider-utils";

const state = globalThis as typeof globalThis & {
  calendarAutoSyncStarted?: boolean;
  calendarAutoSyncTimer?: ReturnType<typeof setTimeout>;
};

export function startCalendarAutoSync() {
  if (state.calendarAutoSyncStarted) return;
  state.calendarAutoSyncStarted = true;
  console.info("[calendar-auto-sync] started; following release times, regular sync interval and retry delay");

  const tick = async () => {
    let delayMs = 60_000;
    try {
      if (process.env.CALENDAR_AUTO_SYNC === "true" && calendarConfig().enabled) {
        // The shared MongoDB lease also coordinates manual and external syncs.
        const result = await syncCalendar();
        if (result.nextAttemptAt) {
          delayMs = Math.max(1_000, Math.min(60_000,
            new Date(result.nextAttemptAt).getTime() - Date.now()));
        }
        if (result.status === "synced") {
          console.info("[calendar-auto-sync] completed", {
            events: result.events,
            lastUpdated: result.lastUpdated,
          });
        } else {
          console.info("[calendar-auto-sync] skipped", {
            reason: result.reason,
            nextAttemptAt: result.nextAttemptAt
              ? formatCambodiaDate(result.nextAttemptAt)
              : null,
          });
        }
      }
    } catch (error) {
      console.error("[calendar-auto-sync] failed", {
        code: error instanceof ProviderError ? error.code : "SYNC_FAILED",
      });
    } finally {
      // Schedule after completion so slow provider requests cannot overlap.
      state.calendarAutoSyncTimer = setTimeout(() => void tick(), delayMs);
      state.calendarAutoSyncTimer.unref();
    }
  };

  state.calendarAutoSyncTimer = setTimeout(() => void tick(), 1_000);
  state.calendarAutoSyncTimer.unref();
}
