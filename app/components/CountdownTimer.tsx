"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function CountdownTimer({ targetDate }: { targetDate: string | Date }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const target = new Date(targetDate).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = target - now;

      if (distance <= 0) {
        setTimeLeft("Started");
        // Force a reload when it reaches zero so the page unlocks
        window.location.reload();
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimeLeft(parts.join(" "));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="flex flex-col items-center justify-center bg-blue-50 border border-blue-100 rounded-2xl p-6 dark:bg-blue-950/20 dark:border-blue-900/30">
      <Clock size={24} className="text-blue-500 mb-2" />
      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
        Exam Starts In
      </span>
      <span className="text-3xl font-black text-slate-900 dark:text-zinc-50 tracking-tight font-mono">
        {timeLeft || "--"}
      </span>
    </div>
  );
}
