export type RateLimitInfo = {
  limit: string;
  remaining: string;
  resetSeconds: string;
  resetAt: number;
  minute?: WindowInfo;
  day?: WindowInfo;
};

export type WindowInfo = {
  limit: string;
  remaining: string;
  resetSeconds: string;
};

const STORAGE_KEY = "aceai_rate_limit";
const EVENT_NAME = "aceai:ratelimit";

export const readRateLimit = (): RateLimitInfo | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RateLimitInfo>;
    if (!parsed.limit || !parsed.remaining || !parsed.resetSeconds) {
      return null;
    }
    if (!parsed.resetAt) {
      const resetSeconds = Number(parsed.resetSeconds);
      parsed.resetAt = Date.now() + (Number.isFinite(resetSeconds) ? resetSeconds * 1000 : 0);
    }
    return parsed as RateLimitInfo;
  } catch {
    return null;
  }
};

export const writeRateLimit = (info: Omit<RateLimitInfo, "resetAt">) => {
  if (typeof window === "undefined") return;
  const resetSeconds = Number(info.resetSeconds);
  const resetAt = Date.now() + (Number.isFinite(resetSeconds) ? resetSeconds * 1000 : 0);
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...info, resetAt })
  );
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const writeRateLimitFromHeaders = (headers: Headers) => {
  const remaining = headers.get("x-ratelimit-remaining");
  const limit = headers.get("x-ratelimit-limit");
  const resetSeconds = headers.get("x-ratelimit-reset");
  if (!remaining || !limit || !resetSeconds) return;

  const minute = readWindow(headers, "x-ratelimit-minute");
  const day = readWindow(headers, "x-ratelimit-day");

  if (!day) return;

  writeRateLimit({
    remaining: day.remaining,
    limit: day.limit,
    resetSeconds: day.resetSeconds,
    minute,
    day,
  });
};

const readWindow = (headers: Headers, prefix: string): WindowInfo | undefined => {
  const limit = headers.get(`${prefix}-limit`);
  const remaining = headers.get(`${prefix}-remaining`);
  const resetSeconds = headers.get(`${prefix}-reset`);
  if (!limit || !remaining || !resetSeconds) return undefined;
  return { limit, remaining, resetSeconds };
};

export const onRateLimitChange = (handler: () => void) => {
  if (typeof window === "undefined") return () => {};
  const storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) handler();
  };
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", storageHandler);
  };
};
