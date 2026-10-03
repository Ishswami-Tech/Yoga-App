"use client";
import { useEffect, useState } from "react";
import { istEpoch, classPhase, type ClassPhase } from "./format";
import { Clock, Flame, CheckCircle2, Play } from "lucide-react";

type Props = {
  date: string; // YYYY-MM-DD IST
  startTime: string; // HH:mm IST
  endTime: string; // HH:mm IST
  variant?: "hero" | "compact" | "minimal";
  className?: string;
};

type Tick = {
  phase: ClassPhase;
  remainingMs: number;
  totalMs: number;
  elapsedMs: number;
  label: string;
  sub: string;
  pct: number; // 0..1 — progress through the live window when live, or countdown fraction
};

function computeTick(date: string, start: string, end: string, now: number): Tick {
  const s = istEpoch(date, start);
  const e = istEpoch(date, end);
  if (Number.isNaN(s) || Number.isNaN(e)) {
    return {
      phase: "ended",
      remainingMs: 0,
      totalMs: 0,
      elapsedMs: 0,
      label: "—",
      sub: "",
      pct: 0,
    };
  }
  const phase = classPhase(date, start, end, now);
  if (phase === "before") {
    const remainingMs = s - now;
    return {
      phase,
      remainingMs,
      totalMs: s - now,
      elapsedMs: 0,
      label: formatDuration(remainingMs),
      sub: "until class starts",
      pct: 0,
    };
  }
  if (phase === "live") {
    const totalMs = e - s;
    const elapsedMs = now - s;
    const remainingMs = e - now;
    return {
      phase,
      remainingMs,
      totalMs,
      elapsedMs,
      label: formatDuration(remainingMs),
      sub: "remaining in class",
      pct: Math.min(1, elapsedMs / totalMs),
    };
  }
  return {
    phase: "ended",
    remainingMs: 0,
    totalMs: e - s,
    elapsedMs: e - s,
    label: "Class ended",
    sub: "See you tomorrow 🙏",
    pct: 1,
  };
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function splitDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { d, h, m, s };
}

export function ClassCountdown({ date, startTime, endTime, variant = "hero", className }: Props) {
  const [now, setNow] = useState(() => Date.now());
  // Tick every second for a smooth countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const tick = computeTick(date, startTime, endTime, now);

  if (variant === "minimal") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm ${className ?? ""}`}>
        {tick.phase === "live" ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-emerald-600 dark:text-emerald-300">Live now</span>
          </>
        ) : tick.phase === "before" ? (
          <>
            <Clock className="h-3.5 w-3.5" />
            <span>{tick.label}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Ended</span>
          </>
        )}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${className ?? ""} ${
        tick.phase === "live"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : tick.phase === "before"
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground"
      }`}>
        {tick.phase === "live" ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">LIVE</span>
            <span className="tabular-nums">· {tick.label}</span>
          </>
        ) : tick.phase === "before" ? (
          <>
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums">{tick.label}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{tick.label}</span>
          </>
        )}
      </div>
    );
  }

  // hero variant — big segmented countdown with live progress bar
  const { d, h, m, s } = splitDuration(
    tick.phase === "before" ? tick.remainingMs : tick.remainingMs
  );
  const segments =
    d > 0
      ? [
          { v: d, l: "days" },
          { v: h, l: "hrs" },
          { v: m, l: "min" },
          { v: s, l: "sec" },
        ]
      : [
          { v: h, l: "hrs" },
          { v: m, l: "min" },
          { v: s, l: "sec" },
        ];

  return (
    <div className={className}>
      {tick.phase === "live" ? (
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white text-emerald-700 px-4 py-1.5 text-sm font-semibold shadow">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE NOW
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 text-primary-foreground">
              <Flame className="h-5 w-5 text-amber-300" />
              <span className="text-2xl font-bold tabular-nums">{tick.label}</span>
            </div>
            <p className="text-xs text-primary-foreground/70">{tick.sub}</p>
          </div>
          {/* Live progress bar */}
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.max(2, tick.pct * 100)}%` }}
            />
          </div>
        </div>
      ) : tick.phase === "before" ? (
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs text-primary-foreground">
            <Clock className="h-3.5 w-3.5" /> Class starts soon
          </div>
          <div className="flex items-end gap-2">
            {segments.map((seg, i) => (
              <div key={seg.l} className="flex items-end gap-2">
                <div className="text-center">
                  <div className="grid place-items-center min-w-[3.2rem] rounded-xl bg-white/15 backdrop-blur px-3 py-2.5">
                    <span className="text-3xl font-bold tabular-nums text-primary-foreground">
                      {pad(seg.v)}
                    </span>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-primary-foreground/70 mt-1">
                    {seg.l}
                  </p>
                </div>
                {i < segments.length - 1 && (
                  <span className="text-2xl font-bold text-primary-foreground/40 mb-5">:</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs text-primary-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Class ended
          </div>
          <p className="text-sm text-primary-foreground/80">{tick.sub}</p>
        </div>
      )}
    </div>
  );
}
