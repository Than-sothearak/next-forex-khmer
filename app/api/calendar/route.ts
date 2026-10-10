import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import EconomicEvent from "@/models/EconomicEvent";
import CalendarSync from "@/models/CalendarSync";
import { calendarConfig } from "@/lib/calendar/config";
import { calendarQuery } from "@/lib/calendar/dates";
import { demoEvents } from "@/lib/calendar/demo";
import { cachedTranslations } from "@/lib/calendar/translations";
import type { CalendarResponse } from "@/lib/calendar/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  let query;
  try {
    query = calendarQuery(request.nextUrl.searchParams);
  } catch {
    return NextResponse.json(
      {
        error: "INVALID_FILTERS",
        message: "Use a valid date range of at most 31 days.",
      },
      { status: 400, headers },
    );
  }
  const config = calendarConfig();
  const meta: CalendarResponse["meta"] = {
    mode: config.enabled ? "provider" : "demo",
    source: config.enabled ? config.sourceName : "Demo · ទិន្នន័យសាកល្បង",
    sourceUrl: config.enabled ? config.sourceUrl : null,
    lastUpdated: null,
    stale: false,
    warning: null,
    translationPending: false,
    coverage: null,
    refreshSeconds: 60,
    syncIntervalMinutes: config.syncIntervalMinutes,
  };
  if (!config.enabled) {
    const events = demoEvents().filter(
      (event) =>
        new Date(event.eventAt) >= query.from &&
        new Date(event.eventAt) < query.to &&
        (!query.currency || event.currency === query.currency) &&
        (!query.country || event.country === query.country) &&
        (!query.impact || event.impact === query.impact),
    );
    return NextResponse.json({ events, meta } satisfies CalendarResponse, {
      headers,
    });
  }
  try {
    await connectMongo();
    const filter = {
      provider: config.provider,
      eventAt: { $gte: query.from, $lt: query.to },
      ...(query.currency && { currency: query.currency }),
      ...(query.country && { country: query.country }),
      ...(query.impact && { impact: query.impact }),
    };
    const [rows, state] = await Promise.all([
      EconomicEvent.find(filter)
        .sort({ eventAt: 1, providerId: 1 })
        .limit(5001)
        .lean(),
      CalendarSync.findById(config.provider).lean(),
    ]);
    if (rows.length > 5000)
      return NextResponse.json(
        { error: "NARROW_DATE_RANGE" },
        { status: 400, headers },
      );
    let translations = new Map<string, string>();
    try {
      translations = await cachedTranslations(
        rows.flatMap((row) => [row.titleEn, row.descriptionEn || ""]),
      );
    } catch {
      meta.translationPending = true;
    }
    meta.lastUpdated = state?.lastSuccess?.toISOString() || null;
    meta.coverage =
      state?.coverageFrom && state?.coverageTo
        ? {
            from: state.coverageFrom.toISOString(),
            to: state.coverageTo.toISOString(),
          }
        : null;
    meta.stale =
      !state?.lastSuccess ||
      Date.now() - state.lastSuccess.getTime() >
        config.syncIntervalMinutes * 120_000 ||
      !!state.lastError;
    meta.warning = state?.lastError
      ? "PROVIDER_ERROR"
      : !state?.lastSuccess
        ? "AWAITING_SYNC"
        : !state.coverageFrom ||
            !state.coverageTo ||
            query.from < state.coverageFrom ||
            query.to > state.coverageTo
          ? "OUTSIDE_COVERAGE"
          : meta.stale
            ? "STALE_DATA"
            : null;
    const events = rows.map((row) => ({
      provider: row.provider,
      providerId: row.providerId,
      titleEn: row.titleEn,
      titleKm: translations.get(row.titleEn) || null,
      descriptionEn: row.descriptionEn ?? null,
      descriptionKm: row.descriptionEn
        ? translations.get(row.descriptionEn) || null
        : null,
      country: row.country,
      currency: row.currency,
      eventAt: row.eventAt.toISOString(),
      timeTentative: row.timeTentative,
      impact: row.impact,
      actual: row.actual ?? null,
      forecast: row.forecast ?? null,
      previous: row.previous ?? null,
      source: row.source,
      sourceUrl: row.sourceUrl ?? null,
      providerUpdatedAt: row.providerUpdatedAt?.toISOString() || null,
    }));
    meta.translationPending ||= events.some(
      (event) =>
        !event.titleKm || (!!event.descriptionEn && !event.descriptionKm),
    );
    return NextResponse.json({ events, meta } satisfies CalendarResponse, {
      headers,
    });
  } catch (error) {
    console.error("[calendar-api] GET failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      mongodbConfigured: Boolean(process.env.MONGODB_URI),
      apifyConfigured: Boolean(process.env.APIFY_API_TOKEN),
    });
    return NextResponse.json(
      { error: "DATABASE_UNAVAILABLE" },
      { status: 503, headers },
    );
  }
}
