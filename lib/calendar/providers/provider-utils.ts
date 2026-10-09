import { validDay } from "../dates";

export class ProviderError extends Error {
  constructor(
    public code: string,
    public retryAfterSeconds = 300,
  ) {
    super(code);
  }
}

export function utcTimestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(
      value,
    )
  )
    throw new ProviderError("INVALID_PROVIDER_DATE");

  if (
    !validDay(value.slice(0, 10)) ||
    Number(value.slice(11, 13)) > 23 ||
    Number(value.slice(14, 16)) > 59 ||
    Number(value.slice(17, 19)) > 59
  )
    throw new ProviderError("INVALID_PROVIDER_DATE");

  const timestamp = new Date(
    /(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`,
  );
  if (!Number.isFinite(timestamp.getTime()))
    throw new ProviderError("INVALID_PROVIDER_DATE");
  return timestamp.toISOString();
}

export function retryDelay(value: string | null, now = Date.now()): number {
  const seconds =
    value && /^\d+$/.test(value)
      ? Number(value)
      : value
        ? (Date.parse(value) - now) / 1000
        : 300;
  return Number.isFinite(seconds) ? Math.max(60, Math.ceil(seconds)) : 300;
}
