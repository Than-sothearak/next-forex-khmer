import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncCalendar } from "@/lib/calendar/sync";
import { ProviderError } from "@/lib/calendar/providers/trading-economics-data";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
export async function POST(request: NextRequest) {
  const expected = process.env.CALENDAR_SYNC_SECRET;
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
  try {
    return NextResponse.json(await syncCalendar(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "SYNC_FAILED";
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
