import type { CalendarEvent } from "./types";
import { addDays, cambodiaDate } from "./dates";
// Authored UI examples, never copied from a provider. No sample market figures.
export function demoEvents(today = cambodiaDate()): CalendarEvent[] {
  const examples = [
    [
      "United States",
      "USD",
      "Consumer Price Index",
      "សន្ទស្សន៍ថ្លៃទំនិញប្រើប្រាស់",
      "high",
      "19:30",
      "Measures changes in consumer prices.",
      "វាស់វែងការប្រែប្រួលថ្លៃទំនិញ និងសេវាកម្មដែលអ្នកប្រើប្រាស់ទិញ។",
    ],
    [
      "United Kingdom",
      "GBP",
      "Gross Domestic Product",
      "ផលិតផលក្នុងស្រុកសរុប",
      "high",
      "13:00",
      "Measures the value of goods and services produced.",
      "វាស់វែងតម្លៃទំនិញ និងសេវាកម្មដែលផលិតក្នុងប្រទេស។",
    ],
    [
      "Japan",
      "JPY",
      "Household Spending",
      "ការចំណាយរបស់គ្រួសារ",
      "medium",
      "06:30",
      "Tracks changes in household spending.",
      "តាមដានការប្រែប្រួលនៃការចំណាយរបស់គ្រួសារ។",
    ],
    [
      "Euro Area",
      "EUR",
      "Industrial Production",
      "ផលិតកម្មឧស្សាហកម្ម",
      "medium",
      "16:00",
      "Tracks changes in industrial output.",
      "តាមដានការប្រែប្រួលនៃទិន្នផលឧស្សាហកម្ម។",
    ],
    [
      "Canada",
      "CAD",
      "Employment Change",
      "ការប្រែប្រួលចំនួនអ្នកមានការងារធ្វើ",
      "high",
      "19:30",
      "Tracks changes in the number of employed people.",
      "តាមដានការកើនឡើង ឬថយចុះនៃចំនួនអ្នកមានការងារធ្វើ។",
    ],
    [
      "Australia",
      "AUD",
      "Consumer Confidence",
      "ទំនុកចិត្តអ្នកប្រើប្រាស់",
      "low",
      "07:30",
      "Reflects consumer expectations about the economy.",
      "បង្ហាញការរំពឹងទុករបស់អ្នកប្រើប្រាស់ចំពោះសេដ្ឋកិច្ច។",
    ],
  ];
  return [0, 1, 2, 3, 4, 5, 6]
    .flatMap((offset) =>
      examples.map(
        (
          [
            country,
            currency,
            titleEn,
            titleKm,
            impact,
            time,
            descriptionEn,
            descriptionKm,
          ],
          index,
        ) => ({
          provider: "demo",
          providerId: `demo-${offset}-${index}`,
          titleEn,
          titleKm,
          descriptionEn,
          descriptionKm,
          country,
          currency,
          eventAt: new Date(
            `${addDays(today, offset)}T${time}:00+07:00`,
          ).toISOString(),
          timeTentative: false,
          impact: impact as CalendarEvent["impact"],
          actual: null,
          forecast: null,
          previous: null,
          source: "Demo · ទិន្នន័យសាកល្បង",
          sourceUrl: null,
          providerUpdatedAt: null,
        }),
      ),
    )
    .sort((a, b) => a.eventAt.localeCompare(b.eventAt));
}
