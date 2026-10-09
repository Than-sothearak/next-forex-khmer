"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calendarPresets,
  cambodiaDate,
  dayBounds,
  khmerDateLabel,
  TIME_ZONE,
} from "@/lib/calendar/dates";
import { countries } from "@/lib/calendar/countries";
import type {
  CalendarEvent,
  CalendarResponse,
  Impact,
} from "@/lib/calendar/types";
import NewsFeed from "./news-feed";

const impactLabels: Record<Impact, string> = {
  high: "ខ្ពស់",
  medium: "មធ្យម",
  low: "ទាប",
};
const warnings: Record<string, string> = {
  AWAITING_SYNC: "កំពុងរង់ចាំការធ្វើសមកាលកម្មដំបូងពីប្រភពទិន្នន័យ។",
  PROVIDER_ERROR:
    "មិនអាចធ្វើបច្ចុប្បន្នភាពពីប្រភពបានទេ។ ទិន្នន័យដែលបានរក្សាទុកអាចហួសសម័យ។",
  OUTSIDE_COVERAGE:
    "កាលបរិច្ឆេទមួយចំនួននៅក្រៅចន្លោះដែលបានធ្វើសមកាលកម្ម។ បញ្ជីនេះអាចមិនពេញលេញ។",
  STALE_DATA:
    "ទិន្នន័យមិនទាន់បានធ្វើបច្ចុប្បន្នភាពថ្មីទេ។ សូមពិនិត្យពេលវេលាធ្វើបច្ចុប្បន្នភាពខាងក្រោម។",
};
function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, string> = {
    calendar:
      "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Zm2 10h2m4 0h2m-8 3h2",
    clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    refresh:
      "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1",
    arrow: "m9 5 7 7-7 7",
    globe:
      "M2 12h20M12 2a17 17 0 0 1 0 20 17 17 0 0 1 0-20Zm10 10a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    book: "M12 5v16M3 3l9 2 9-2v16l-9 2-9-2V3Zm3 5 3 1m6 0 3-1",
    info: "M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    chart: "M4 20V4m0 16h17M8 15l4-5 4 2 5-7",
    filter: "M4 6h16M7 12h10m-7 6h4",
    check: "m5 12 4 4L19 6",
  };
  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] || paths.info} />
    </svg>
  );
}
const impactStyles: Record<Impact, string> = {
  high: "bg-[#fff0ee] text-[#cb615b]",
  medium: "bg-[#fff7e8] text-[#b88a35] [&_i:last-child]:opacity-25",
  low: "bg-[#edf5f7] text-[#6b91a0] [&_i:nth-child(n+2)]:opacity-25",
};
function ImpactBadge({ impact }: { impact: Impact }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded px-1.5 py-0.5 text-[9px] leading-[1.8] whitespace-nowrap ${impactStyles[impact]}`}
    >
      <span
        className="inline-flex h-[11px] items-end gap-0.5 [&>i]:block [&>i]:w-0.5 [&>i]:rounded-[1px] [&>i]:bg-current [&>i:first-child]:h-1 [&>i:nth-child(2)]:h-[7px] [&>i:last-child]:h-2.5"
        aria-hidden="true"
      >
        <i />
        <i />
        <i />
      </span>
      {impactLabels[impact]}
    </span>
  );
}
function dateLabel(day: string) {
  return khmerDateLabel(day);
}
function timeLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(date));
}
function updatedLabel(date: string) {
  return `${khmerDateLabel(cambodiaDate(new Date(date)))} · ${timeLabel(date)}`;
}

export default function Calendar({ initialDate }: { initialDate: string }) {
  const [range, setRange] = useState({ from: initialDate, to: initialDate });
  const [currency, setCurrency] = useState("");
  const [country, setCountry] = useState("");
  const [impact, setImpact] = useState("");
  const [showEnglish, setShowEnglish] = useState(true);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationUnavailable, setTranslationUnavailable] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [insights, setInsights] = useState<
    Record<
      string,
      {
        status: "loading" | "busy" | "unavailable" | "ready";
        eventNameKm?: string;
        overviewKm?: string;
        valuesExplanationKm?: string;
        marketScenarios?: Array<{
          scenarioKm: string;
          usdKm: string;
          goldKm: string;
          otherCurrenciesKm: string;
        }>;
        summaryHigherKm?: string;
        summaryLowerKm?: string;
        summaryWatchKm?: string;
        reminderKm?: string;
        message?: string;
      }
    >
  >({});
  const active = useRef<AbortController | null>(null);
  const translationActive = useRef<AbortController | null>(null);
  const translationRange = useRef<string | null>(null);
  const eventDialog = useRef<HTMLDialogElement | null>(null);
  const loadedRange = useRef("");
  const rangeKey = `${range.from}/${range.to}`;
  let invalidRange = false;
  try {
    dayBounds(range.from, range.to);
  } catch {
    invalidRange = true;
  }

  const load = useCallback(async () => {
    if (invalidRange) {
      setLoading(false);
      return;
    }
    active.current?.abort();
    if (translationRange.current !== rangeKey) {
      translationActive.current?.abort();
      translationActive.current = null;
      translationRange.current = null;
      setTranslationLoading(false);
      setTranslationUnavailable(false);
    }
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError("");
    if (loadedRange.current !== rangeKey) setData(null);
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(
        `/api/calendar?${new URLSearchParams(range)}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) throw new Error("CALENDAR_UNAVAILABLE");
      const result = (await response.json()) as CalendarResponse;
      if (!Array.isArray(result.events) || !result.meta)
        throw new Error("INVALID_RESPONSE");
      if (active.current !== controller) return;
      setData(result);
      loadedRange.current = rangeKey;
      setCheckedAt(new Date().toISOString());
      if (
        result.meta.mode === "provider" &&
        result.meta.translationPending &&
        !translationActive.current
      ) {
        const translationController = new AbortController();
        translationActive.current = translationController;
        translationRange.current = rangeKey;
        setTranslationLoading(true);
        void fetch(`/api/calendar/translate?${new URLSearchParams(range)}`, {
          method: "POST",
          cache: "no-store",
          signal: translationController.signal,
        })
          .then(async (translationResponse) => {
            if (!translationResponse.ok)
              throw new Error("TRANSLATION_UNAVAILABLE");
            return translationResponse.json() as Promise<{
              translations?: Array<{ original: string; translated: string }>;
              pending?: boolean;
              status?: "complete" | "translated" | "busy" | "unavailable";
            }>;
          })
          .then((translationResult) => {
            if (
              translationController.signal.aborted ||
              translationRange.current !== rangeKey
            )
              return;
            setTranslationUnavailable(
              translationResult.status === "unavailable",
            );
            const translations = new Map(
              (translationResult.translations || []).map(
                ({ original, translated }) => [original, translated],
              ),
            );
            setData((current) =>
              current
                ? {
                    ...current,
                    meta: {
                      ...current.meta,
                      translationPending: !!translationResult.pending,
                    },
                    events: current.events.map((event) => ({
                      ...event,
                      titleKm: translations.get(event.titleEn) || event.titleKm,
                      descriptionKm: event.descriptionEn
                        ? translations.get(event.descriptionEn) ||
                          event.descriptionKm
                        : null,
                    })),
                  }
                : current,
            );
          })
          .catch(() => {
            if (
              !translationController.signal.aborted &&
              translationRange.current === rangeKey
            )
              setTranslationUnavailable(true);
          })
          .finally(() => {
            if (translationActive.current === translationController) {
              translationActive.current = null;
              setTranslationLoading(false);
            }
          });
      }
    } catch {
      if (active.current === controller)
        setError(
          "មិនអាចទាញយកប្រតិទិនបានទេ។ សូមពិនិត្យការតភ្ជាប់ ហើយព្យាយាមម្តងទៀត។",
        );
    } finally {
      window.clearTimeout(timeout);
      if (active.current === controller) setLoading(false);
    }
  }, [range, rangeKey, invalidRange]);
  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active.current?.abort();
      translationActive.current?.abort();
      active.current = null;
      translationActive.current = null;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);
  useEffect(() => {
    const dialog = eventDialog.current;
    if (!dialog || !selectedEvent || dialog.open) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [selectedEvent]);

  const events = useMemo(
    () =>
      (data?.events || []).filter(
        (event) =>
          (!currency || event.currency === currency) &&
          (!country || event.country === country) &&
          (!impact || event.impact === impact),
      ),
    [data, currency, country, impact],
  );
  const groups = useMemo(
    () =>
      events.reduce<Record<string, CalendarEvent[]>>((days, event) => {
        const day = cambodiaDate(new Date(event.eventAt));
        (days[day] ||= []).push(event);
        return days;
      }, {}),
    [events],
  );
  const currencies = [
    ...new Set([
      ...(data?.events || []).map((event) => event.currency).filter(Boolean),
      ...(currency ? [currency] : []),
    ]),
  ].sort();
  const countryOptions = [
    ...new Set([
      ...(data?.events || []).map((event) => event.country),
      ...(country ? [country] : []),
    ]),
  ].sort();
  const demo = data?.meta.mode === "demo";
  const resetFilters = () => {
    setCurrency("");
    setCountry("");
    setImpact("");
  };
  const presets = calendarPresets(checkedAt ? cambodiaDate(new Date(checkedAt)) : initialDate);
  const count = data && !invalidRange ? events.length : "—";

  const loadInsight = async (event: CalendarEvent, retry = false) => {
    if (demo) return;
    const current = insights[event.providerId];
    if (
      !retry &&
      (current?.status === "loading" || current?.status === "ready")
    )
      return;
    setInsights((previous) => ({
      ...previous,
      [event.providerId]: { status: "loading" },
    }));
    try {
      const response = await fetch("/api/calendar/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: event.providerId }),
      });
      const result = (await response.json()) as {
        status?: string;
        insight?: {
          eventNameKm: string;
          overviewKm: string;
          valuesExplanationKm: string;
          marketScenarios: Array<{
            scenarioKm: string;
            usdKm: string;
            goldKm: string;
            otherCurrenciesKm: string;
          }>;
          summaryHigherKm: string;
          summaryLowerKm: string;
          summaryWatchKm: string;
          reminderKm: string;
        };
        error?: string;
      };
      if (response.status === 202 || result.status === "busy") {
        setInsights((previous) => ({
          ...previous,
          [event.providerId]: {
            status: "busy",
            message: "Another request is preparing this explanation…",
          },
        }));
      } else if (!response.ok || !result.insight) {
        const message =
          result.error === "OPENAI_NOT_CONFIGURED"
            ? "ត្រូវកំណត់ OPENAI_API_KEY ដើម្បីបង្កើតការពន្យល់ AI។"
            : result.error === "PROVIDER_NOT_CONFIGURED"
              ? "ការពន្យល់ AI ប្រើបាននៅពេលភ្ជាប់ប្រតិទិនពីប្រភពដែលបានកំណត់។"
              : "មិនអាចបង្កើតការពន្យល់បានទេ។ សូមសាកល្បងម្ដងទៀតពេលក្រោយ។";
        setInsights((previous) => ({
          ...previous,
          [event.providerId]: { status: "unavailable", message },
        }));
      } else {
        setInsights((previous) => ({
          ...previous,
          [event.providerId]: { status: "ready", ...result.insight },
        }));
      }
    } catch {
      setInsights((previous) => ({
        ...previous,
        [event.providerId]: {
          status: "unavailable",
          message: "មិនអាចភ្ជាប់សេវាពន្យល់បានទេ។ សូមសាកល្បងម្ដងទៀត។",
        },
      }));
    }
  };

  return (
    <div className="min-h-screen">
      <a
        className="fixed -top-20 left-5 z-100 bg-white p-3 focus:top-2.5"
        href="#calendar"
      >
        ទៅកាន់ប្រតិទិន
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 shadow-[0_4px_18px_rgba(23,42,57,.035)] backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-8 py-4 max-[800px]:px-5 max-[560px]:gap-y-2.5 max-[560px]:px-4 max-[560px]:py-3">
          <a
            href="/"
            className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-.6px] text-[#183b35] [&>span:last-child>span]:text-brand"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-brand text-white shadow-[0_5px_12px_rgba(22,130,105,.2)]">
              <Icon name="chart" size={22} />
            </span>
            <span>
              Forex<span>Khmer</span>
            </span>
          </a>
          <nav
            aria-label="ម៉ឺនុយចម្បង"
            className="order-3 flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap min-[1000px]:order-none min-[1000px]:w-auto"
          >
            <a
              className="rounded-full bg-[#eaf5f0] px-4 py-2 text-[11px] font-semibold text-brand"
              href="#calendar"
            >
              ប្រតិទិន
            </a>
            <a
              className="rounded-full px-4 py-2 text-[11px] text-[#63757b] transition-colors hover:bg-[#f3f7f5] hover:text-brand"
              href="#news"
            >
              ព័ត៌មានទីផ្សារ
            </a>
            <a
              className="rounded-full px-4 py-2 text-[11px] text-[#63757b] transition-colors hover:bg-[#f3f7f5] hover:text-brand"
              href="#guide"
            >
              របៀបអាន
            </a>
            <a
              className="rounded-full px-4 py-2 text-[11px] text-[#63757b] transition-colors hover:bg-[#f3f7f5] hover:text-brand"
              href="#data-source"
            >
              ប្រភពទិន្នន័យ
            </a>
          </nav>
          <div className="flex items-center gap-2 rounded-full border border-line bg-[#fbfcfc] px-3.5 py-2 text-[10px] text-[#526671] max-[560px]:px-2.5">
            <span className="text-[16px]">🇰🇭</span>
            <span className="max-[560px]:hidden">ភ្នំពេញ</span>
            <Icon name="clock" size={14} />
            <span>UTC+7</span>
          </div>
        </div>
      </header>
      <div>
        <main
          className="mx-auto max-w-[1620px] px-[38px] pt-[33px] pb-5 min-[1600px]:pt-[42px] max-[1250px]:px-6 max-[1250px]:pt-7 max-[1250px]:pb-[18px] max-[800px]:pt-[25px] max-[560px]:px-[14px] max-[560px]:pt-[23px] max-[560px]:pb-5"
          id="calendar"
        >
          <section className="mb-7 flex items-center justify-between gap-[22px] overflow-hidden rounded-[18px] border border-[#dcebe3] bg-linear-[125deg,#eaf5f0,#ffffff_58%,#eef6f4] px-7 py-6 shadow-[0_10px_30px_rgba(31,86,65,.045)] [&_h1]:text-[32px] [&_h1]:font-semibold [&_h1]:leading-[1.7] [&_h1]:tracking-[-.6px] [&_p]:mt-1.5 [&_p]:text-[12px] [&_p]:text-muted min-[1600px]:[&_h1]:text-[36px] max-[800px]:mb-[22px] max-[800px]:px-5 max-[800px]:py-5 max-[800px]:[&_h1]:text-[27px] max-[800px]:[&_p]:text-[11px] max-[560px]:rounded-[14px] max-[560px]:px-4 max-[560px]:py-4 max-[560px]:[&_h1]:text-[24px] max-[560px]:[&_p]:leading-[2]">
            <div>
              <div className="mb-[11px] flex items-center gap-2 text-[9px] font-semibold tracking-[1.8px] text-brand [&>span]:size-1.5 [&>span]:rounded-full [&>span]:bg-brand max-[560px]:mb-2 max-[560px]:text-[8px]">
                <span /> ECONOMIC CALENDAR
              </div>
              <h1>ប្រតិទិនសេដ្ឋកិច្ច Forex</h1>
              <p>
                ត្រៀមខ្លួនសម្រាប់ព្រឹត្តិការណ៍សំខាន់ៗ។ តាមដានទីផ្សារជាភាសាខ្មែរ។
              </p>
            </div>
            <div
              data-testid="today-card"
              className="flex shrink-0 items-center gap-3 rounded-xl border border-[#dce9e2] bg-white/90 px-4 py-3 shadow-[0_5px_18px_rgba(31,86,65,.05)] [&>svg]:text-brand [&_small]:block [&_small]:text-[9px] [&_small]:text-muted [&_b]:text-[11px] [&_b]:font-medium max-[800px]:hidden"
            >
              <Icon name="calendar" size={23} />
              <div>
                <small>ម៉ោងកម្ពុជា</small>
                <b>{dateLabel(initialDate)}</b>
              </div>
            </div>
          </section>
          {demo && (
            <div
              className="mb-[23px] flex items-center gap-[14px] rounded-[9px] border border-[#ecdbb4] bg-[#fffaf0] px-[17px] py-[15px] text-[#835f29] [&_strong]:text-[12px] [&_strong]:font-semibold [&_strong_span]:ml-2 [&_strong_span]:rounded [&_strong_span]:border [&_strong_span]:border-[#e2c999] [&_strong_span]:px-[5px] [&_strong_span]:py-0.5 [&_strong_span]:align-middle [&_strong_span]:text-[8px] [&_strong_span]:tracking-[1px] [&_p]:mt-1 [&_p]:max-w-[1040px] [&_p]:text-[11px] [&_p]:leading-[1.9] [&_p]:text-[#927448] [&>a]:ml-auto max-[560px]:items-start max-[560px]:gap-2.5 max-[560px]:p-[13px] max-[560px]:[&_strong]:text-[11px] max-[560px]:[&_p]:text-[10px] max-[560px]:[&>a]:hidden"
              role="status"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#faecd1] max-[560px]:size-[26px] max-[560px]:[&>svg]:w-[17px]">
                <Icon name="info" />
              </span>
              <div>
                <strong>
                  ទិន្នន័យសាកល្បង <span>DEMO</span>
                </strong>
                <p>
                  ព្រឹត្តិការណ៍ និងពេលវេលាខាងក្រោមគឺជាឧទាហរណ៍
                  មិនមែនជាកាលវិភាគទីផ្សារពិតទេ។ ត្រូវការ API key
                  និងអាជ្ញាបណ្ណចែកចាយទិន្នន័យ ដើម្បីបង្ហាញទិន្នន័យពីប្រភព។
                </p>
              </div>
              <a href="#data-source" aria-label="មើលប្រភពទិន្នន័យ">
                <Icon name="arrow" />
              </a>
            </div>
          )}
          <section
            className="mb-[26px] grid grid-cols-3 gap-[18px] max-[800px]:gap-2.5 max-[560px]:mb-5 max-[560px]:gap-2"
            aria-label="សង្ខេបព្រឹត្តិការណ៍ដែលបានជ្រើសរើស"
          >
            <div className="flex items-center gap-[15px] rounded-[10px] border border-line bg-white px-5 py-[18px] [&>div>span]:text-[11px] [&>div>span]:text-muted [&_strong]:flex [&_strong]:items-baseline [&_strong]:gap-2.5 [&_strong]:text-[25px] [&_strong]:font-semibold [&_strong]:leading-[1.6] [&_small]:text-[10px] [&_small]:font-normal [&_small]:text-[#88959c] min-[1600px]:p-[23px] max-[1250px]:p-[15px] max-[1250px]:[&_strong]:text-[23px] max-[1250px]:[&>div>span]:text-[10px] max-[800px]:gap-2.5 max-[800px]:[&_small]:hidden max-[800px]:[&_strong]:text-[22px] max-[560px]:block max-[560px]:p-3 max-[560px]:[&>div>span]:block max-[560px]:[&>div>span]:min-h-[34px] max-[560px]:[&>div>span]:text-[9px] max-[560px]:[&>div>span]:leading-[1.9] max-[560px]:[&_strong]:mt-0.5">
              <span className="grid size-[45px] shrink-0 place-items-center rounded-[11px] max-[1250px]:h-[39px] max-[1250px]:w-[37px] max-[560px]:mb-[9px] max-[560px]:size-[30px] max-[560px]:rounded-[7px] max-[560px]:[&>svg]:w-4 bg-[#eaf6f1] text-[#258e70]">
                <Icon name="calendar" />
              </span>
              <div>
                <span>ព្រឹត្តិការណ៍សរុប{demo ? " · សាកល្បង" : ""}</span>
                <strong>
                  {count}
                  <small>ព្រឹត្តិការណ៍</small>
                </strong>
              </div>
            </div>
            <div className="flex items-center gap-[15px] rounded-[10px] border border-line bg-white px-5 py-[18px] [&>div>span]:text-[11px] [&>div>span]:text-muted [&_strong]:flex [&_strong]:items-baseline [&_strong]:gap-2.5 [&_strong]:text-[25px] [&_strong]:font-semibold [&_strong]:leading-[1.6] [&_small]:text-[10px] [&_small]:font-normal [&_small]:text-[#88959c] min-[1600px]:p-[23px] max-[1250px]:p-[15px] max-[1250px]:[&_strong]:text-[23px] max-[1250px]:[&>div>span]:text-[10px] max-[800px]:gap-2.5 max-[800px]:[&_small]:hidden max-[800px]:[&_strong]:text-[22px] max-[560px]:block max-[560px]:p-3 max-[560px]:[&>div>span]:block max-[560px]:[&>div>span]:min-h-[34px] max-[560px]:[&>div>span]:text-[9px] max-[560px]:[&>div>span]:leading-[1.9] max-[560px]:[&_strong]:mt-0.5">
              <span className="grid size-[45px] shrink-0 place-items-center rounded-[11px] max-[1250px]:h-[39px] max-[1250px]:w-[37px] max-[560px]:mb-[9px] max-[560px]:size-[30px] max-[560px]:rounded-[7px] max-[560px]:[&>svg]:w-4 bg-[#fff0ef] text-[#d96961]">
                <Icon name="chart" />
              </span>
              <div>
                <span>ព្រឹត្តិការណ៍ឥទ្ធិពលខ្ពស់</span>
                <strong>
                  {data && !invalidRange
                    ? events.filter((event) => event.impact === "high").length
                    : "—"}
                  <small>ត្រូវតាមដាន</small>
                </strong>
              </div>
            </div>
            <div className="flex items-center gap-[15px] rounded-[10px] border border-line bg-white px-5 py-[18px] [&>div>span]:text-[11px] [&>div>span]:text-muted [&_strong]:flex [&_strong]:items-baseline [&_strong]:gap-2.5 [&_strong]:text-[25px] [&_strong]:font-semibold [&_strong]:leading-[1.6] [&_small]:text-[10px] [&_small]:font-normal [&_small]:text-[#88959c] min-[1600px]:p-[23px] max-[1250px]:p-[15px] max-[1250px]:[&_strong]:text-[23px] max-[1250px]:[&>div>span]:text-[10px] max-[800px]:gap-2.5 max-[800px]:[&_small]:hidden max-[800px]:[&_strong]:text-[22px] max-[560px]:block max-[560px]:p-3 max-[560px]:[&>div>span]:block max-[560px]:[&>div>span]:min-h-[34px] max-[560px]:[&>div>span]:text-[9px] max-[560px]:[&>div>span]:leading-[1.9] max-[560px]:[&_strong]:mt-0.5">
              <span className="grid size-[45px] shrink-0 place-items-center rounded-[11px] max-[1250px]:h-[39px] max-[1250px]:w-[37px] max-[560px]:mb-[9px] max-[560px]:size-[30px] max-[560px]:rounded-[7px] max-[560px]:[&>svg]:w-4 bg-[#edf3fc] text-[#698cc2]">
                <Icon name="globe" />
              </span>
              <div>
                <span>រូបិយប័ណ្ណក្នុងបញ្ជី</span>
                <strong>
                  {data && !invalidRange
                    ? new Set(
                        events.map((event) => event.currency).filter(Boolean),
                      ).size
                    : "—"}
                  <small>រូបិយប័ណ្ណ</small>
                </strong>
              </div>
            </div>
          </section>
          <div className="grid grid-cols-[minmax(0,1fr)_264px] items-start gap-[23px] min-[1600px]:grid-cols-[minmax(0,1fr)_290px] max-[1250px]:grid-cols-[minmax(0,1fr)] max-[560px]:gap-[18px]">
            <section
              className="rounded-[11px] border border-line bg-white overflow-hidden"
              aria-label="ប្រតិទិនព្រឹត្តិការណ៍"
            >
              <div className="flex items-center justify-between gap-3 px-[22px] pt-[22px] pb-[19px] max-[560px]:px-[15px] max-[560px]:py-[18px] max-[560px]:[&_h2]:text-[15px]">
                <div>
                  <div className="mb-[5px] block text-[10px] text-muted max-[560px]:text-[9px]">
                    តាមដានព្រឹត្តិការណ៍
                  </div>
                  <h2>កាលវិភាគសេដ្ឋកិច្ច</h2>
                </div>
                <button
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[#dfe7e7] bg-white px-[11px] py-2 text-[10px] hover:border-[#bad5ca] hover:bg-[#f2f8f5] [&_svg]:text-brand max-[560px]:min-h-10 max-[560px]:gap-[5px] max-[560px]:px-2 max-[560px]:py-[7px] max-[560px]:text-[9px]"
                  disabled={loading || invalidRange}
                  onClick={() => void load()}
                >
                  <Icon
                    name="refresh"
                    size={17}
                    className={
                      loading ? "animate-spin motion-reduce:animate-none" : ""
                    }
                  />
                  <span>{loading ? "កំពុងទាញយក" : "ធ្វើបច្ចុប្បន្នភាព"}</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2.5 px-[22px] pb-[18px] max-[560px]:px-[15px] max-[560px]:pb-[15px]">
                <div className="flex flex-wrap gap-[3px] rounded-[7px] bg-[#f2f5f6] p-1 max-[560px]:w-full">
                  {presets.map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={range.from === item.from && range.to === item.to}
                      className={`min-h-[30px] rounded px-3 py-[5px] text-[10px] whitespace-nowrap max-[560px]:min-h-[34px] max-[560px]:flex-1 ${range.from === item.from && range.to === item.to ? "bg-white font-semibold text-brand shadow-[0_1px_4px_#19382d14]" : "text-[#7c8a93]"}`}
                      onClick={() => {
                        const current = calendarPresets(cambodiaDate()).find((preset) => preset.id === item.id)!;
                        setRange({ from: current.from, to: current.to });
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <span className="flex items-center gap-1.5 text-[9px] whitespace-nowrap text-[#85929a]">
                  <Icon name="clock" size={14} /> ភ្នំពេញ (UTC+7)
                </span>
              </div>
              <div className="grid grid-cols-[1fr_1fr_.8fr_1fr_.8fr] gap-2.5 border-t border-line bg-[#fdfefe] px-[22px] pt-[17px] pb-[15px] [&>label]:flex [&>label]:min-w-0 [&>label]:flex-col [&>label]:gap-1.5 [&>label]:text-[10px] [&>label]:text-[#798992] max-[560px]:grid-cols-6 max-[560px]:gap-x-2 max-[560px]:gap-y-3 max-[560px]:p-[15px] max-[560px]:[&>label]:col-span-2 max-[560px]:[&>label:nth-child(-n+2)]:col-span-3">
                <label>
                  ចាប់ពីថ្ងៃ
                  <input
                    className="min-h-[37px] w-full min-w-0 rounded-[5px] border border-[#e1e7eb] bg-white px-2 py-[7px] text-[#405666] max-[560px]:min-h-[42px] text-[11px]"
                    aria-label="ចាប់ពីថ្ងៃ"
                    type="date"
                    value={range.from}
                    onChange={(event) =>
                      setRange((current) => ({
                        ...current,
                        from: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  ដល់ថ្ងៃ
                  <input
                    className="min-h-[37px] w-full min-w-0 rounded-[5px] border border-[#e1e7eb] bg-white px-2 py-[7px] text-[#405666] max-[560px]:min-h-[42px] text-[11px]"
                    aria-label="ដល់ថ្ងៃ"
                    type="date"
                    value={range.to}
                    onChange={(event) =>
                      setRange((current) => ({
                        ...current,
                        to: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  រូបិយប័ណ្ណ
                  <select
                    className="min-h-[37px] w-full min-w-0 rounded-[5px] border border-[#e1e7eb] bg-white px-2 py-[7px] text-[#405666] max-[560px]:min-h-[42px] pr-1 text-[10px] max-[560px]:text-[11px]"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                  >
                    <option value="">ទាំងអស់</option>
                    {currencies.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  ប្រទេស
                  <select
                    className="min-h-[37px] w-full min-w-0 rounded-[5px] border border-[#e1e7eb] bg-white px-2 py-[7px] text-[#405666] max-[560px]:min-h-[42px] pr-1 text-[10px] max-[560px]:text-[11px]"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                  >
                    <option value="">ទាំងអស់</option>
                    {countryOptions.map((value) => (
                      <option key={value} value={value}>
                        {countries[value]?.km || value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  កម្រិតឥទ្ធិពល
                  <select
                    className="min-h-[37px] w-full min-w-0 rounded-[5px] border border-[#e1e7eb] bg-white px-2 py-[7px] text-[#405666] max-[560px]:min-h-[42px] pr-1 text-[10px] max-[560px]:text-[11px]"
                    value={impact}
                    onChange={(event) => setImpact(event.target.value)}
                  >
                    <option value="">ទាំងអស់</option>
                    {Object.entries(impactLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center justify-between gap-2 px-[22px] pt-px pb-[17px] max-[560px]:gap-[5px] max-[560px]:px-[15px] max-[560px]:pt-0 max-[560px]:pb-[14px]">
                <label className="flex cursor-pointer items-center gap-[7px] text-[10px] text-[#6f7f89] max-[560px]:gap-[5px]">
                  <input
                    className="size-3.5 accent-brand"
                    type="checkbox"
                    checked={showEnglish}
                    onChange={(event) => setShowEnglish(event.target.checked)}
                  />
                  <span>បង្ហាញឈ្មោះអង់គ្លេស</span>
                  <span className="rounded-[3px] border border-[#e2e8ec] bg-[#eff3f5] px-1 text-[8px] text-[#8b969d] max-[560px]:hidden">
                    EN
                  </span>
                </label>
                <button
                  data-testid="text-button"
                  className="flex min-h-8 items-center gap-1 text-[9px] text-[#85959d] max-[560px]:text-[10px]"
                  onClick={resetFilters}
                >
                  <Icon name="filter" size={14} />
                  សម្អាតតម្រង
                </button>
              </div>
              {invalidRange && (
                <div
                  data-testid="inline-message"
                  className="mx-5 mb-4 flex items-start gap-2 rounded-md p-3 text-[11px] leading-[1.9] max-[560px]:mx-[15px] flex-wrap bg-[#fff0ee] text-[#af4e47] [&>button]:p-0 [&>button]:underline"
                  role="alert"
                >
                  សូមជ្រើសរើសថ្ងៃចាប់ផ្ដើម និងថ្ងៃបញ្ចប់ត្រឹមត្រូវ
                  ក្នុងរយៈពេលមិនលើសពី ៣១ ថ្ងៃ។
                </div>
              )}
              {error && (
                <div
                  data-testid="inline-message"
                  className="mx-5 mb-4 flex items-start gap-2 rounded-md p-3 text-[11px] leading-[1.9] max-[560px]:mx-[15px] flex-wrap bg-[#fff0ee] text-[#af4e47] [&>button]:p-0 [&>button]:underline"
                  role="alert"
                >
                  {error}
                  {data && " កំពុងបង្ហាញទិន្នន័យដែលបានទាញយកមុននេះ។"}
                  <button onClick={() => void load()}>ព្យាយាមម្តងទៀត</button>
                </div>
              )}
              {data?.meta.warning && (
                <div
                  data-testid="inline-message"
                  className="mx-5 mb-4 flex items-start gap-2 rounded-md p-3 text-[11px] leading-[1.9] max-[560px]:mx-[15px] bg-[#fff7e7] text-[#8f7449]"
                  role="status"
                >
                  <Icon name="info" size={18} />
                  {warnings[data.meta.warning] || warnings.PROVIDER_ERROR}
                </div>
              )}
              {data?.meta.translationPending && (
                <p className="mx-5 mb-[15px] text-[10px] text-[#8c8066] max-[560px]:mx-[15px]">
                  {translationUnavailable
                    ? "ការបកប្រែ AI មិនទាន់អាចប្រើបានទេ។ សូមពិនិត្យ API key និងសមតុល្យ OpenAI។"
                    : translationLoading
                      ? "កំពុងបកប្រែឈ្មោះព្រឹត្តិការណ៍ជាភាសាខ្មែរ…"
                      : "ឈ្មោះមួយចំនួនកំពុងរង់ចាំការបកប្រែ។"}{" "}
                  អត្ថបទអង់គ្លេសដើមនៅតែអាចអានបាន។
                </p>
              )}
              <p className="hidden max-[560px]:mx-[15px] max-[560px]:mb-3 max-[560px]:block max-[560px]:text-[10px] max-[560px]:text-[#758993]">
                អូសតារាងទៅឆ្វេង ដើម្បីមើលកម្រិតឥទ្ធិពល និងតម្លៃទាំងអស់ →
              </p>
              <div aria-busy={loading}>
                {loading && !data && (
                  <div
                    data-testid="loading-state"
                    className="p-6 [&>span]:mb-5 [&>span]:block [&>span]:text-[12px] [&>span]:text-[#7b8e9a]"
                    role="status"
                  >
                    <span>កំពុងទាញយកប្រតិទិន…</span>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <div
                        key={value}
                        className="mb-[14px] h-12 animate-pulse rounded-[5px] bg-[#e8eeef] motion-reduce:animate-none"
                      />
                    ))}
                  </div>
                )}
                {!invalidRange && data && events.length > 0 && (
                  <div
                    data-testid="table-scroll"
                    className="w-full overflow-x-auto"
                  >
                    <table className="w-full table-fixed border-collapse text-left max-[560px]:min-w-[650px]">
                      <caption className="sr-only">
                        {demo ? "ប្រតិទិនសាកល្បង" : "ប្រតិទិនសេដ្ឋកិច្ច"} ·
                        ម៉ោងកម្ពុជា UTC+7
                      </caption>
                      <thead className="bg-canvas [&_th]:border-y [&_th]:border-line [&_th]:px-[9px] [&_th]:py-3 [&_th]:text-[9px] [&_th]:font-medium [&_th]:text-[#82909b] [&_th:first-child]:w-[10%] [&_th:first-child]:pl-5 [&_th:nth-child(2)]:w-[13%] [&_th:nth-child(3)]:w-[32%] [&_th:nth-child(4)]:w-[13%] [&_th:nth-child(n+5)]:w-[10.6%] [&_th:nth-child(n+5)]:text-right [&_th:last-child]:pr-5">
                        <tr>
                          <th>ម៉ោង</th>
                          <th>រូបិយប័ណ្ណ</th>
                          <th>ព្រឹត្តិការណ៍</th>
                          <th>ឥទ្ធិពល</th>
                          <th>ជាក់ស្ដែង</th>
                          <th>ការព្យាករណ៍</th>
                          <th>ទិន្ន័យមុន</th>
                        </tr>
                      </thead>
                      {Object.entries(groups).map(([day, dayEvents]) => (
                        <tbody key={day}>
                          <tr className="[&>th]:border-b [&>th]:border-line [&>th]:bg-[#f9fbfc] [&>th]:px-5 [&>th]:py-2.5 [&>th]:text-[10px] [&>th]:font-medium [&>th]:text-[#617382] [&_small]:float-right [&_small]:text-[9px] [&_small]:font-normal [&_small]:text-[#92a0a9]">
                            <th colSpan={7}>
                              <span>{dateLabel(day)}</span>
                              {demo && (
                                <span className="ml-2 rounded-[3px] border border-[#e5d6b7] px-1 py-px text-[7px] tracking-[.4px] text-[#a18758]">
                                  DEMO
                                </span>
                              )}
                              <small>{dayEvents.length} ព្រឹត្តិការណ៍</small>
                            </th>
                          </tr>
                          {dayEvents.map((event) => (
                            <tr
                              data-testid="event-row"
                              className={`text-[11px] hover:bg-[#fafcfb] [&>td]:border-b [&>td]:border-[#edf1f4] [&>td]:px-[9px] [&>td]:py-5 [&>td]:align-top last:[&>td]:border-b-0 [&>td:first-child]:pl-5 [&>td:last-child]:pr-5 min-[1600px]:[&>td]:py-6 ${event.impact === "high" ? "[&>td:first-child]:shadow-[inset_3px_0_#e28d86]" : ""}`}
                              key={event.providerId}
                            >
                              <td className="text-[11px] font-medium text-[#677985] tabular-nums [&>small]:block [&>small]:text-[8px] [&>small]:font-normal [&>small]:text-[#a28762]">
                                <time dateTime={event.eventAt}>
                                  {timeLabel(event.eventAt)}
                                </time>
                                {event.timeTentative && (
                                  <small>បណ្ដោះអាសន្ន</small>
                                )}
                              </td>
                              <td>
                                <div className="flex items-center gap-[7px] [&>span]:text-[17px] [&>span]:leading-[1.4] [&>b]:text-[10px] [&>b]:font-semibold">
                                  <span
                                    aria-label={
                                      countries[event.country]?.km ||
                                      event.country
                                    }
                                  >
                                    {countries[event.country]?.flag || "🌐"}
                                  </span>
                                  <b>{event.currency || "—"}</b>
                                </div>
                              </td>
                              <td
                                className={
                                  'text-[11px] leading-[1.9] max-[560px]:text-[12px] [&_summary]:cursor-pointer [&_summary]:list-none [&_summary]:pr-2 [&_summary::-webkit-details-marker]:hidden [&_summary]:after:ml-[7px] [&_summary]:after:text-[11px] [&_summary]:after:text-[#9da9af] [&_summary]:after:content-["⌄"] [&_details[open]_summary]:after:content-["⌃"]'
                                }
                              >
                                <button
                                  type="button"
                                  className="group text-left leading-[1.9] text-[#315b4b] underline-offset-2 hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                                  aria-haspopup="dialog"
                                  onClick={() => {
                                    setSelectedEvent(event);
                                    void loadInsight(event);
                                  }}
                                >
                                  <span lang={event.titleKm ? "km" : "en"}>
                                    {event.titleKm || event.titleEn}
                                  </span>
                                  {showEnglish && event.titleKm && (
                                    <span
                                      className="block font-normal text-[#85929b]"
                                      lang="en"
                                    >
                                      {event.titleEn}
                                    </span>
                                  )}
                                  <span
                                    aria-hidden="true"
                                    className="ml-1 inline-block text-[#9da9af] transition-transform group-hover:translate-x-0.5"
                                  >
                                    ↗
                                  </span>
                                </button>
                              </td>
                              <td>
                                <ImpactBadge impact={event.impact} />
                              </td>
                              <td className="text-right font-semibold text-[#314d48] tabular-nums wrap-anywhere">
                                {event.actual ?? "—"}
                              </td>
                              <td className="text-right text-[#687b86] tabular-nums wrap-anywhere">
                                {event.forecast ?? "—"}
                              </td>
                              <td className="text-right text-[#94a0a8] tabular-nums wrap-anywhere">
                                {event.previous ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))}
                    </table>
                  </div>
                )}
                {!loading && data && !invalidRange && events.length === 0 && (
                  <div
                    data-testid="empty-state"
                    className="px-5 pt-12 pb-[60px] text-center text-[#748b95] [&>h3]:text-[15px] [&>h3]:font-semibold [&>p]:mt-2 [&>p]:mb-5 [&>p]:text-[11px]"
                  >
                    <span className="mb-[17px] inline-grid size-[62px] place-items-center rounded-full bg-[#eff6f2] text-[#69967f]">
                      <Icon name="calendar" size={30} />
                    </span>
                    <h3>មិនមានព្រឹត្តិការណ៍ត្រូវនឹងតម្រងនេះទេ</h3>
                    <p>សាកល្បងជ្រើសរើសកាលបរិច្ឆេទផ្សេង ឬសម្អាតតម្រងរបស់អ្នក។</p>
                    <button
                      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[#dfe7e7] bg-white px-[11px] py-2 text-[10px] hover:border-[#bad5ca] hover:bg-[#f2f8f5] [&_svg]:text-brand max-[560px]:min-h-10 max-[560px]:gap-[5px] max-[560px]:px-2 max-[560px]:py-[7px] max-[560px]:text-[9px]"
                      onClick={resetFilters}
                    >
                      សម្អាតតម្រង
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-between gap-2 border-t border-line px-5 py-[13px] text-[9px] text-[#91a0a8] [&>span:first-child]:flex [&>span:first-child]:items-center [&>span:first-child]:gap-1.5 max-[560px]:flex-col max-[560px]:px-[15px]">
                <span>
                  <span className="size-[5px] rounded-full bg-[#88ad9c]" />{" "}
                  ពិនិត្យទិន្នន័យរៀងរាល់ ៦០ វិនាទី
                </span>
                <span aria-live="polite">
                  {checkedAt
                    ? `បានពិនិត្យ៖ ${timeLabel(checkedAt)}`
                    : "កំពុងរង់ចាំទិន្នន័យ"}
                </span>
              </div>
            </section>
            <aside className="flex flex-col gap-5 max-[1250px]:grid max-[1250px]:grid-cols-2 max-[560px]:grid-cols-1 max-[560px]:gap-4">
              <section
                className="rounded-[11px] border border-[#dfeae3] bg-[#edf4f1] p-[22px] [&>h2]:text-[14px] [&_dl>div]:mb-[15px] [&_dt]:text-[9px] [&_dt]:text-[#899c8e] [&_dd]:mt-[3px] [&_dd]:text-[10px] [&_dd]:leading-[1.9] [&_dd]:text-[#516e5f] [&_dd_span]:block [&_dd_span]:text-[8px] [&_dd_span]:text-[#7c9385] [&>a]:mt-3 [&>a]:block [&>a]:text-[11px] [&>a]:text-brand max-[1250px]:p-[23px] max-[1250px]:[&_dl]:flex max-[1250px]:[&_dl]:gap-6 max-[1250px]:[&_dl>div]:flex-1 max-[560px]:p-5 max-[560px]:[&_dl]:gap-[18px]"
                id="data-source"
              >
                <div className="mb-[17px] flex items-center justify-between max-[560px]:mb-3">
                  <span className="text-[#51846d]">
                    <Icon name="globe" size={22} />
                  </span>
                  <span
                    className={`rounded px-[7px] py-[3px] text-[8px] tracking-[.4px] ${demo ? "bg-[#e4eade] text-[#7d8767]" : "bg-[#dcece2] text-[#587d67]"}`}
                  >
                    {!data
                      ? "កំពុងពិនិត្យ"
                      : demo
                        ? "DEMO MODE"
                        : data.meta.stale
                          ? "ទិន្នន័យចាស់"
                          : "បានធ្វើសមកាលកម្ម"}
                  </span>
                </div>
                <h2>ប្រភពទិន្នន័យ</h2>
                <p className="mt-[5px] text-[11px] text-[#688371]">
                  {data?.meta.source || "កំពុងពិនិត្យប្រភព…"}
                </p>
                <div className="my-[17px] border-t border-[#d7e4db]" />
                <dl>
                  <div>
                    <dt>ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ</dt>
                    <dd>
                      {data?.meta.lastUpdated
                        ? updatedLabel(data.meta.lastUpdated)
                        : "មិនទាន់មានការធ្វើសមកាលកម្ម"}
                    </dd>
                  </div>
                  <div>
                    <dt>តំបន់ពេលវេលា</dt>
                    <dd>
                      Asia/Phnom_Penh <span>UTC+7</span>
                    </dd>
                  </div>
                </dl>
                <p className="text-[10px] leading-[2] text-[#829387]">
                  {demo
                    ? "នេះជាទិន្នន័យសម្រាប់បង្ហាញមុខងារគេហទំព័រប៉ុណ្ណោះ។ មិនមានទិន្នន័យទីផ្សារពិតទេ។"
                    : `ទាញយកពីប្រភពតាមកាលវិភាគ ${data?.meta.syncIntervalMinutes || 15} នាទី។ ប៊ូតុងធ្វើបច្ចុប្បន្នភាពទាញយកទិន្នន័យដែលបានរក្សាទុកចុងក្រោយ។`}
                </p>
                {data?.meta.sourceUrl && (
                  <a
                    href={data.meta.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {data.meta.source} ↗
                  </a>
                )}
              </section>
              <section
                className="rounded-[11px] border border-line bg-white p-[22px] [&>h2]:text-[14px] [&>p]:mt-2.5 [&>p]:text-[10px] [&>p]:leading-[2] [&>p]:text-[#85939c] max-[1250px]:p-[23px] max-[560px]:p-5 max-[560px]:[&>p]:text-[11px]"
                id="guide"
              >
                <span className="mb-[5px] block text-[10px] text-muted max-[560px]:text-[9px]">
                  ស្វែងយល់បន្ថែម
                </span>
                <h2>របៀបអានប្រតិទិន</h2>
                <p>
                  កម្រិតឥទ្ធិពលបង្ហាញសារៈសំខាន់របស់ព្រឹត្តិការណ៍ចំពោះទីផ្សារ។
                </p>
                <div className="flex flex-col gap-[13px] border-b border-line py-[19px] [&>div]:flex [&>div]:items-center [&>div]:gap-2.5 [&>div>span:last-child]:text-[9px] [&>div>span:last-child]:text-[#809099] [&>div>span:first-child]:min-w-[66px] [&>div>span:first-child]:justify-center max-[1250px]:flex-row max-[1250px]:flex-wrap max-[1250px]:[&>div]:flex-col max-[1250px]:[&>div]:gap-1 max-[560px]:justify-between max-[560px]:gap-2.5">
                  <div>
                    <ImpactBadge impact="high" />
                    <span>អាចបង្កការប្រែប្រួលខ្លាំង</span>
                  </div>
                  <div>
                    <ImpactBadge impact="medium" />
                    <span>គួរតាមដាន</span>
                  </div>
                  <div>
                    <ImpactBadge impact="low" />
                    <span>ឥទ្ធិពលតិចជាង</span>
                  </div>
                </div>
                <dl className="my-4 [&>div]:mb-2.5 [&>div]:flex [&>div]:justify-between [&>div]:gap-2 [&>div]:text-[9px] [&_dt]:text-[#5c707b] [&_dd]:text-right [&_dd]:text-[#9ba6ad] max-[1250px]:[&>div]:justify-start max-[1250px]:[&>div]:gap-[15px] max-[560px]:[&>div]:justify-between">
                  <div>
                    <dt>ទិន្ន័យបច្ចុប្បន្ន</dt>
                    <dd>លទ្ធផលដែលប្រភពបានប្រកាស</dd>
                  </div>
                  <div>
                    <dt>ការព្យាករណ៍</dt>
                    <dd>ការរំពឹងជាមធ្យមមុនពេលចេញផ្សាយ</dd>
                  </div>
                  <div>
                    <dt>ទិន្ន័យមុន</dt>
                    <dd>លទ្ធផលពីលើកមុន ដែលអាចត្រូវបានកែសម្រួល</dd>
                  </div>
                </dl>
                <p className="text-[9px] leading-[1.9] text-[#85939c]">
                  ប្រៀបធៀប ទិន្ន័យបច្ចុប្បន្ន ជាមួយ ការព្យាករណ៍
                  ដើម្បីមើលថាលទ្ធផលខុសពីការរំពឹងយ៉ាងណា។
                  ភាពខុសគ្នាអាចប៉ះពាល់ដល់រូបិយប័ណ្ណ អត្រាការប្រាក់ និងមាស
                  ប៉ុន្តែទិសដៅមិនប្រាកដទេ
                  ហើយទីផ្សារអាចបានរំពឹងទុកព័ត៌មាននេះរួចហើយ។
                </p>
                <p className="border-t border-line pt-[13px] text-[9px]!">
                  សញ្ញា «—» មានន័យថាមិនមានតម្លៃ។
                  ចុចឈ្មោះព្រឹត្តិការណ៍ដើម្បីអានបន្ថែម។
                </p>
              </section>
            </aside>
          </div>
          <NewsFeed />
          <footer className="mt-[34px] flex justify-between gap-[15px] border-t border-[#e4e9ed] pt-[17px] text-[9px] text-[#9ca8b0] [&>span:first-child]:text-[#75868d] [&>span:first-child>span]:text-[#459782] [&_i]:mx-2 [&_i]:not-italic max-[800px]:flex-col max-[800px]:gap-[5px] max-[560px]:mt-[25px] max-[560px]:text-[8px]">
            <span>
              Forex<span>Khmer</span> <i>·</i> ប្រតិទិនសេដ្ឋកិច្ចសម្រាប់កម្ពុជា
            </span>
            <span>ព័ត៌មានសម្រាប់ស្វែងយល់ មិនមែនជាដំបូន្មានវិនិយោគទេ។</span>
          </footer>
        </main>
        <dialog
          ref={eventDialog}
          aria-labelledby="event-dialog-title"
          onClose={() => setSelectedEvent(null)}
          onClick={(clickEvent) => {
            if (clickEvent.target === clickEvent.currentTarget)
              eventDialog.current?.close();
          }}
          className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-white p-0 text-ink backdrop:bg-[#102b27]/65 sm:m-auto sm:h-auto sm:max-h-[88dvh] sm:w-[min(94vw,900px)] sm:rounded-2xl sm:shadow-2xl"
        >
          {selectedEvent &&
            (() => {
              const insight = insights[selectedEvent.providerId];
              const eventDay = cambodiaDate(new Date(selectedEvent.eventAt));
              return (
                <div className="flex h-dvh flex-col bg-white sm:h-auto sm:max-h-[88dvh] sm:rounded-2xl">
                  <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line bg-white px-5 py-4 sm:rounded-t-2xl sm:px-7 sm:py-5">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-[#70818a]">
                        <span>
                          {countries[selectedEvent.country]?.flag || "🌐"}
                        </span>
                        <b className="text-[#314d48]">
                          {selectedEvent.currency || "—"}
                        </b>
                        <span>·</span>
                        <time dateTime={selectedEvent.eventAt}>
                          {dateLabel(eventDay)} ·{" "}
                          {timeLabel(selectedEvent.eventAt)} ភ្នំពេញ
                        </time>
                        <ImpactBadge impact={selectedEvent.impact} />
                      </div>
                      <h2
                        id="event-dialog-title"
                        className="font-khmer text-[18px] font-semibold leading-[1.8] text-[#203c35] sm:text-[21px]"
                      >
                        {insight?.eventNameKm ||
                          selectedEvent.titleKm ||
                          selectedEvent.titleEn}
                      </h2>
                      {showEnglish && selectedEvent.titleKm && (
                        <p
                          className="mt-1 font-khmer text-[18px] font-semibold leading-[1.8] text-muted sm:text-[21px]"
                          lang="en"
                        >
                          {selectedEvent.titleEn}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      autoFocus
                      aria-label="បិទការពន្យល់"
                      onClick={() => eventDialog.current?.close()}
                      className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-[24px] leading-none text-[#6c7d82] hover:bg-[#f3f7f5] focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      ×
                    </button>
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 font-khmer text-[14px] leading-[2] text-[#526a61] sm:px-7 sm:py-6 max-[560px]:text-[15px]">
                    {selectedEvent.descriptionKm ||
                    selectedEvent.descriptionEn ? (
                      <section className="mb-5 rounded-xl border border-line bg-[#fbfcfc] p-4">
                        <h3 className="text-[13px] font-semibold text-[#526a61]">
                          ព័ត៌មានព្រឹត្តិការណ៍
                        </h3>
                        <p className="mt-1">
                          {selectedEvent.descriptionKm ||
                            selectedEvent.descriptionEn}
                        </p>
                        {showEnglish &&
                          selectedEvent.descriptionKm &&
                          selectedEvent.descriptionEn && (
                            <p
                              className="mt-2 border-t border-line pt-2 text-[12px] text-muted"
                              lang="en"
                            >
                              {selectedEvent.descriptionEn}
                            </p>
                          )}
                      </section>
                    ) : null}

                    {demo ? (
                      <div
                        className="rounded-xl border border-[#ecdbb4] bg-[#fffaf0] p-4 text-[#835f29]"
                        role="status"
                      >
                        <h3 className="font-semibold">ទិន្នន័យសាកល្បង</h3>
                        <p className="mt-1">
                          ការពន្យល់ AI
                          នឹងបង្ហាញនៅពេលប្រើព្រឹត្តិការណ៍ពីប្រភពទិន្នន័យដែលបានកំណត់។
                          ព្រឹត្តិការណ៍នេះជាទិន្នន័យសាកល្បង។
                        </p>
                      </div>
                    ) : insight?.status === "ready" ? (
                      <div className="space-y-6">
                        <section>
                          <h3 className="text-[16px] font-semibold text-[#315b4b] sm:text-[17px]">
                            {countries[selectedEvent.country]?.flag || "🌐"}{" "}
                            {insight.eventNameKm ||
                              selectedEvent.titleKm ||
                              selectedEvent.titleEn}{" "}
                            ជាអ្វី?
                          </h3>
                          <p className="mt-2">{insight.overviewKm}</p>
                        </section>
                        <section>
                          <h3 className="text-[15px] font-semibold text-[#315b4b]">
                            📊 ទិន្ន័យបច្ចុប្បន្ន, ការព្យាករណ៍ និង ទិន្ន័យមុន
                          </h3>
                          <p className="mt-2">{insight.valuesExplanationKm}</p>
                        </section>
                        <section>
                          <h3 className="text-[15px] font-semibold text-[#315b4b]">
                            📈 ផលប៉ះពាល់ដល់ទីផ្សារ
                          </h3>
                          <div className="mt-2 overflow-x-auto rounded-lg border border-[#dce8e1] bg-white">
                            <table className="w-full min-w-[520px] border-collapse text-left text-[13px] leading-[1.8] max-[560px]:text-[14px]">
                              <thead className="bg-[#eef5f0] text-[#456255]">
                                <tr>
                                  <th className="p-2.5 font-semibold">
                                    សេណារីយ៉ូ
                                  </th>
                                  <th className="p-2.5 font-semibold">USD</th>
                                  <th className="p-2.5 font-semibold">
                                    មាស (XAU/USD)
                                  </th>
                                  <th className="p-2.5 font-semibold">
                                    រូបិយប័ណ្ណផ្សេង
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {insight.marketScenarios?.map(
                                  (scenario, index) => (
                                    <tr
                                      key={`${scenario.scenarioKm}-${index}`}
                                      className="border-t border-[#e7efea] align-top"
                                    >
                                      <th className="p-2.5 font-medium text-[#526a61]">
                                        {scenario.scenarioKm}
                                      </th>
                                      <td className="p-2.5">
                                        {scenario.usdKm}
                                      </td>
                                      <td className="p-2.5">
                                        {scenario.goldKm}
                                      </td>
                                      <td className="p-2.5">
                                        {scenario.otherCurrenciesKm}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </section>
                        <section>
                          <h3 className="text-[15px] font-semibold text-[#315b4b]">
                            💡 សរុប
                          </h3>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>
                              <b>ទីផ្សារអាចឡើង៖</b> {insight.summaryHigherKm}
                            </li>
                            <li>
                              <b>ទីផ្សារអាចចុះ៖</b> {insight.summaryLowerKm}
                            </li>
                            <li>
                              <b>ត្រូវតាមដាន៖</b> {insight.summaryWatchKm}
                            </li>
                          </ul>
                          <p className="mt-3 text-[13px] font-medium text-[#74867b]">
                            {insight.reminderKm}
                          </p>
                        </section>
                      </div>
                    ) : insight?.status === "loading" ||
                      insight?.status === "busy" ? (
                      <div
                        className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center font-sans text-[14px] text-[#50665d]"
                        role="status"
                        aria-live="polite"
                      >
                        <span
                          aria-hidden="true"
                          className="size-10 animate-spin rounded-full border-[3px] border-[#dcebe3] border-t-brand motion-reduce:animate-none"
                        />
                        <span>
                          {insight.status === "busy"
                            ? "Another request is preparing this explanation…"
                            : "Analyzing this event and preparing the Khmer explanation…"}
                        </span>
                      </div>
                    ) : (
                      <div
                        className="rounded-xl border border-[#f0d4d1] bg-[#fff7f6] p-4 text-[#a95951]"
                        role="alert"
                      >
                        <p>
                          {insight?.message || "មិនអាចបង្កើតការពន្យល់បានទេ។"}
                        </p>
                        <button
                          type="button"
                          className="mt-2 underline underline-offset-2"
                          onClick={() => void loadInsight(selectedEvent, true)}
                        >
                          ព្យាយាមម្ដងទៀត
                        </button>
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[11px] text-[#829198]">
                      <span>
                        {countries[selectedEvent.country]?.km ||
                          selectedEvent.country}{" "}
                        · {selectedEvent.source}
                      </span>
                      {selectedEvent.sourceUrl && (
                        <a
                          className="font-medium text-brand underline underline-offset-2"
                          href={selectedEvent.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          មើលប្រភព ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
        </dialog>
      </div>
    </div>
  );
}
