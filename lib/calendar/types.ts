export type Impact = 'high' | 'medium' | 'low';
export type CalendarEvent = {
  provider: string;
  providerId: string;
  titleEn: string;
  titleKm: string | null;
  descriptionEn: string | null;
  descriptionKm: string | null;
  country: string;
  currency: string;
  eventAt: string;
  timeTentative: boolean;
  impact: Impact;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  source: string;
  sourceUrl: string | null;
  providerUpdatedAt: string | null;
};
export type CalendarResponse = {
  events: CalendarEvent[];
  meta: {
    mode: 'demo' | 'provider';
    source: string;
    sourceUrl: string | null;
    lastUpdated: string | null;
    stale: boolean;
    warning: string | null;
    translationPending: boolean;
    coverage: { from: string; to: string } | null;
    refreshSeconds: number;
    syncIntervalMinutes: number;
  };
};
