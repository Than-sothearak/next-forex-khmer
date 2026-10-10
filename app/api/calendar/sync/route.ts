import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncCalendar } from "@/lib/calendar/sync";
import { ProviderError } from "@/lib/calendar/providers/provider-utils";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
async function handleSync(request: NextRequest) {
  const expected =
    request.method === "GET"
      ? process.env.CRON_SECRET || process.env.CALENDAR_SYNC_SECRET
      : process.env.CALENDAR_SYNC_SECRET;
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (
    !expected ||
    expected.length < 32 ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  console.info("[calendar-sync] request accepted", { method: request.method });
  try {
    const result = await syncCalendar();
    console.info("[calendar-sync] request finished", {
      status: result.status,
      events: "events" in result ? result.events : undefined,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "SYNC_FAILED";
    console.error("[calendar-sync] request failed", {
      code,
      retryAfterSeconds:
        error instanceof ProviderError ? error.retryAfterSeconds : undefined,
    });
    return NextResponse.json(
      { error: code },
      {
        status: code === "PROVIDER_RATE_LIMIT" ? 429 : 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(
            error instanceof ProviderError ? error.retryAfterSeconds : 300,
          ),
        },
      },
    );
  }
}

// Vercel Cron invokes route handlers with GET and sends CRON_SECRET as a Bearer token.
export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
