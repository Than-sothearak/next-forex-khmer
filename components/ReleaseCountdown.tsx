"use client";

import { useEffect, useState } from "react";

export default function ReleaseCountdown({ eventAt }: { eventAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let startTimer: number | undefined;
    const update = () => {
      const remaining = Math.ceil((new Date(eventAt).getTime() - Date.now()) / 1000);
      if (remaining <= 0) {
        setSecondsLeft(null);
        if (timer !== undefined) window.clearInterval(timer);
        timer = undefined;
        return;
      }
      if (remaining > 60) {
        setSecondsLeft(null);
        if (timer !== undefined) window.clearInterval(timer);
        timer = undefined;
        startTimer = window.setTimeout(update, Math.min((remaining - 60) * 1000, 2_000_000_000));
        return;
      }
      setSecondsLeft(remaining);
      if (timer === undefined) timer = window.setInterval(update, 1000);
    };

    startTimer = window.setTimeout(update, 0);
    return () => {
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [eventAt]);

  if (secondsLeft === null) return <span className="text-[#94a0a8]">—</span>;
  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");
  return <span className="whitespace-nowrap text-[14px] font-semibold text-brand">នៅសល់ {minutes}:{seconds}</span>;
}
