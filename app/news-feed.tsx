"use client";

import { useEffect, useState } from "react";

type NewsItem = {
  _id: string;
  title: string;
  summary: string;
  body: string;
  titleEn?: string | null;
  summaryEn?: string | null;
  bodyEn?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  category?: string | null;
  impact?: "high" | "medium" | "low";
  marketImpactKm?: string | null;
  publishedAt: string;
};

const impactText = { high: "ឥទ្ធិពលខ្ពស់", medium: "ឥទ្ធិពលមធ្យម", low: "ឥទ្ធិពលទាប" };
const impactStyle = {
  high: "border-[#f2ccc8] bg-[#fff2f0] text-[#bd5d56]",
  medium: "border-[#efdfbb] bg-[#fff9ed] text-[#a77a2e]",
  low: "border-[#d6e5e8] bg-[#f1f8f9] text-[#658793]",
};

function publishedLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("km-KH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Phnom_Penh",
  }).format(date);
}

export default function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/news?limit=12", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("NEWS_UNAVAILABLE");
        const result: unknown = await response.json();
        if (!Array.isArray(result)) throw new Error("INVALID_NEWS_RESPONSE");
        setItems(result as NewsItem[]);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  return (
    <section id="news" aria-label="ព័ត៌មានទីផ្សារ" className="mb-8 scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-end gap-3">
        <span className="rounded-full border border-line bg-white px-3 py-1 text-[9px] text-[#72838a]">ម៉ោងភ្នំពេញ · UTC+7</span>
      </div>

      {loading ? (
        <div role="status" className="rounded-xl border border-line bg-white p-6 text-center text-[12px] text-muted">កំពុងទាញយកព័ត៌មាន…</div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-[#f0d4d1] bg-[#fff7f6] p-5 text-[12px] text-[#a95951]">មិនអាចទាញយកព័ត៌មានបានទេ។ សូមព្យាយាមម្ដងទៀតនៅពេលក្រោយ។</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d8e1e2] bg-white p-6 text-center">
          <p className="text-[13px] font-medium text-[#40545b]">មិនទាន់មានអត្ថបទព័ត៌មានទេ</p>
          <p className="mt-1 text-[11px] text-muted">នៅពេលអ្នកផ្សាយអត្ថបទតាម API ប្រព័ន្ធនឹងប្រើ OpenAI បកប្រែ និងរៀបចំការពន្យល់ជាភាសាខ្មែរ។</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[1050px]:grid-cols-2">
          {items.map((item) => {
            const impact = item.impact || "medium";
            return (
              <article key={item._id} className={`rounded-xl border bg-white p-5 shadow-[0_2px_12px_rgba(32,58,60,.035)] ${impact === "high" ? "border-[#edcbc6]" : "border-line"}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-medium ${impactStyle[impact]}`}>{impactText[impact]}</span>
                  {item.category && <span className="text-[10px] text-[#75858a]">{item.category}</span>}
                  <time className="ml-auto text-[9px] text-[#91a0a5]" dateTime={item.publishedAt}>{publishedLabel(item.publishedAt)}</time>
                </div>
                <h3 className="text-[16px] font-semibold leading-[1.8] text-[#2b4145]">{item.title || item.titleEn}</h3>
                <p className="mt-2 whitespace-pre-line text-[12px] leading-[2] text-[#63757b]">{item.summary || item.summaryEn}</p>
                {(item.source || item.sourceUrl) && (
                  <div className="mt-3 text-[9px] text-[#8b999e]">
                    ប្រភព៖ {item.sourceUrl ? <a className="text-brand underline underline-offset-2" href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source || "អានប្រភពដើម"}</a> : item.source}
                  </div>
                )}

                <details className="group mt-4 rounded-lg border border-[#dcebe4] bg-[#f6faf8] open:bg-[#f1f7f4]">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[11px] font-medium text-[#35775f] [&::-webkit-details-marker]:hidden">
                    <span>ចុចដើម្បីមើលការពន្យល់ពីឥទ្ធិពលទីផ្សារ</span>
                    <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
                  </summary>
                  <div className="border-t border-[#dcebe4] px-3.5 py-3">
                    <p className="mb-1.5 text-[9px] font-semibold tracking-wide text-[#54826e]">ការពន្យល់ដោយ AI · ជាភាសាខ្មែរ</p>
                    <p className="whitespace-pre-line text-[11px] leading-[2] text-[#526c60]">{item.marketImpactKm || "មិនទាន់មានការពន្យល់សម្រាប់អត្ថបទនេះទេ។"}</p>
                    <p className="mt-2 text-[9px] leading-[1.8] text-[#84948a]">ការពន្យល់នេះបង្ហាញពីលទ្ធភាពប៉ុណ្ណោះ មិនមែនជាការព្យាករណ៍ ឬដំបូន្មានវិនិយោគទេ។</p>
                  </div>
                </details>

                {item.body && <details className="mt-2 rounded-lg border border-line">
                  <summary className="min-h-10 cursor-pointer list-none px-3.5 py-2 text-[10px] font-medium text-[#63757b] [&::-webkit-details-marker]:hidden">អានអត្ថបទពេញជាភាសាខ្មែរ</summary>
                  <p className="whitespace-pre-line border-t border-line px-3.5 py-3 text-[11px] leading-[2] text-[#63757b]">{item.body}</p>
                </details>}

                {(item.titleEn || item.summaryEn || item.bodyEn) && <details className="mt-2 rounded-lg border border-line">
                  <summary className="min-h-10 cursor-pointer list-none px-3.5 py-2 text-[10px] text-[#829096] [&::-webkit-details-marker]:hidden">មើលអត្ថបទដើមជាភាសាអង់គ្លេស</summary>
                  <div className="space-y-2 border-t border-line px-3.5 py-3 text-[10px] leading-[1.9] text-[#74838a]">
                    {item.titleEn && <p className="font-medium">{item.titleEn}</p>}
                    {item.summaryEn && <p>{item.summaryEn}</p>}
                    {item.bodyEn && <p className="whitespace-pre-line">{item.bodyEn}</p>}
                  </div>
                </details>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
