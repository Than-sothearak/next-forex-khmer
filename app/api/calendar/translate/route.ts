import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import EconomicEvent from "@/models/EconomicEvent";
import { calendarConfig } from "@/lib/calendar/config";
import { calendarQuery } from "@/lib/calendar/dates";
import {
  cachedTranslations,
  translateCalendarBatch,
} from "@/lib/calendar/translations";
import type { CalendarResponse } from "@/lib/calendar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  let query;
  try {
    query = calendarQuery(request.nextUrl.searchParams);
  } catch {
    return NextResponse.json(
      { error: "INVALID_FILTERS" },
      { status: 400, headers },
    );
  }

  const config = calendarConfig();
  if (!config.enabled)
    return NextResponse.json(
      { translations: [], pending: false, status: "complete" },
      { headers },
    );
  try {
    await connectMongo();
    const rows = await EconomicEvent.find({
      provider: config.provider,
      eventAt: { $gte: query.from, $lt: query.to },
      ...(query.currency && { currency: query.currency }),
      ...(query.country && { country: query.country }),
      ...(query.impact && { impact: query.impact }),
    })
      .select("titleEn descriptionEn")
      .sort({ eventAt: 1, providerId: 1 })
      .limit(5001)
      .lean();
    if (rows.length > 5000)
      return NextResponse.json(
        { error: "NARROW_DATE_RANGE" },
        { status: 400, headers },
      );

    const texts = [
      ...new Set(
        rows
          .flatMap((row) => [row.titleEn, row.descriptionEn || ""])
          .filter(Boolean),
      ),
    ];
    const batch = await translateCalendarBatch(config.provider, texts);
    const cache = await cachedTranslations(texts);
    const translations = [...cache.entries()].map(([original, translated]) => ({
      original,
      translated,
    }));
    return NextResponse.json(
      {
        translations,
        pending: translations.length < texts.length,
        status: batch.status,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "TRANSLATION_UNAVAILABLE" },
      { status: 503, headers },
    );
  }
}
