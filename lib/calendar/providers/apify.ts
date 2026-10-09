import "server-only";
import { calendarConfig } from "../config";
import { cambodiaDate } from "../dates";
import { ProviderError, retryDelay } from "./provider-utils";
import {
  APIFY_ACTOR_URL,
  APIFY_EVENT_LIMIT,
  normalizeApifyEvents,
} from "./apify-data";

const ACTOR_ID = "xtracto~forexfactory-calendar";

export class ApifyCalendarProvider {
  readonly id = "apify-forexfactory";
  readonly name = "Apify - Forex Factory";
  readonly url = APIFY_ACTOR_URL;


  async getEvents(from: Date, to: Date) {
    if (!calendarConfig().enabled)
      throw new ProviderError("PROVIDER_NOT_CONFIGURED");

    const dateFrom = cambodiaDate(from);
    const dateTo = cambodiaDate(new Date(to.getTime() - 1));
    const url = new URL(
      `https://api.apify.com/v2/actors/${ACTOR_ID}/run-sync-get-dataset-items`,
    );
    url.searchParams.set("timeout", "120");
    url.searchParams.set("format", "json");

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(130_000),
        headers: {
          Authorization: `Bearer ${process.env.APIFY_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currencies: ["USD", "EUR", "AUD"],
          dateRange: "range",
          rangeFrom: dateFrom,
          rangeTo: dateTo,
          minImpact: "low",
          maxItems: APIFY_EVENT_LIMIT,
          upcomingOnly: false,
          proxyConfiguration: {
            useApifyProxy: true,
            apifyProxyGroups: ["RESIDENTIAL"],
          },
        }),
      });
    } catch {
      throw new ProviderError("PROVIDER_UNAVAILABLE");
    }

    if (response.status === 429)
      throw new ProviderError(
        "PROVIDER_RATE_LIMIT",
        retryDelay(response.headers.get("retry-after")),
      );
    if (response.status === 401 || response.status === 403)
      throw new ProviderError("PROVIDER_AUTHORIZATION");
    if (!response.ok)
      throw new ProviderError(
        response.status === 400 || response.status === 422
          ? "INVALID_PROVIDER_RESPONSE"
          : "PROVIDER_UNAVAILABLE",
      );

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    }

    return normalizeApifyEvents(payload).filter((event) => {
      const eventAt = new Date(event.eventAt);
      return eventAt >= from && eventAt < to;
    });
  }
}
