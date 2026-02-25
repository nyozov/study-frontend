"use client";

import { useEffect, useMemo, useState } from "react";
import { Chip } from "@heroui/react";
import { onRateLimitChange, readRateLimit } from "../lib/rateLimit";

export default function RateLimitBadge() {
  const [info, setInfo] = useState(readRateLimit());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return onRateLimitChange(() => setInfo(readRateLimit()));
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const countdown = useMemo(() => {
    if (!info) return null;
    const remainingMs = info.resetAt - Date.now();
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    return Number.isFinite(seconds) ? seconds : 0;
  }, [info, tick]);

  if (!info) return null;

  const context =
    info.minute && info.hour && info.day
      ? `Minute ${info.minute.remaining}/${info.minute.limit} · Hour ${info.hour.remaining}/${info.hour.limit} · Day ${info.day.remaining}/${info.day.limit}`
      : `${info.remaining}/${info.limit}`;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <Chip variant="soft" color="default" className="muted-chip">
        Rate limit: {context} ·{" "}
        {countdown > 0 ? `resets in ${countdown}s` : "resetting…"}
      </Chip>
    </div>
  );
}
