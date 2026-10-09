import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import EconomicEvent from "@/models/EconomicEvent";
import { calendarConfig } from "@/lib/calendar/config";
import { explainCalendarEvent } from "@/lib/calendar/insights";
import { cachedTranslations } from "@/lib/calendar/translations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_REQUEST" },
      { status: 400, headers },
    );
  }
  const providerId =
    body && typeof body === "object" && "providerId" in body
      ? body.providerId
      : null;
  if (
    typeof providerId !== "string" ||
    !providerId.trim() ||
    providerId.length > 300
  ) {
    return NextResponse.json(
      { error: "INVALID_EVENT" },
      { status: 400, headers },
    );
  }
  const config = calendarConfig();
  if (!config.enabled)
    return NextResponse.json(
      { error: "PROVIDER_NOT_CONFIGURED" },
      { status: 503, headers },
    );
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json(
      { error: "OPENAI_NOT_CONFIGURED" },
      { status: 503, headers },
    );

  try {
    await connectMongo();
    const event = await EconomicEvent.findOne({
      provider: config.provider,
      providerId: providerId.trim(),
    })
      .select(
        "provider providerId titleEn descriptionEn currency country impact eventAt actual forecast previous",
      )
      .lean();
    if (!event)
      return NextResponse.json(
        { error: "EVENT_NOT_FOUND" },
        { status: 404, headers },
      );
    const titleTranslations = await cachedTranslations([event.titleEn]);
    const result = await explainCalendarEvent({
      provider: event.provider,
      providerId: event.providerId,
      titleEn: event.titleEn,
      titleKm: titleTranslations.get(event.titleEn) || null,
      eventDetails: event.descriptionEn ?? null,
      currency: event.currency,
      country: event.country,
      impact: event.impact,
      eventDateKm: new Intl.DateTimeFormat("km-KH", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Asia/Phnom_Penh",
      }).format(event.eventAt),
      actual: event.actual ?? null,
      forecast: event.forecast ?? null,
      previous: event.previous ?? null,
    });
    if (!result.insight) {
      const status = result.status === "busy" ? 202 : 503;
      return NextResponse.json({ status: result.status }, { status, headers });
    }
    return NextResponse.json({ ...result, status: 200 }, { headers });
  } catch (error) {
    console.error("[calendar-explain-api] POST failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      mongodbConfigured: Boolean(process.env.MONGODB_URI),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
    return NextResponse.json(
      { error: "INSIGHT_UNAVAILABLE" },
      { status: 503, headers },
    );
  }
}
