"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, Bell, BellOff, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Anomaly, AnomalySeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { anomaly: Anomaly | null };

const severityClasses: Record<
  AnomalySeverity,
  { wrap: string; chip: string; border: string; ping: string; titleColor: string; bodyColor: string; chipBorder: string }
> = {
  high: {
    wrap: "bg-pastel-rose/60",
    chip: "bg-on-rose/15 text-on-rose",
    border: "border-pastel-rose",
    ping: "bg-on-rose/20",
    titleColor: "text-on-rose",
    bodyColor: "text-on-rose/90",
    chipBorder: "border-on-rose/30 bg-on-rose/10 text-on-rose",
  },
  medium: {
    wrap: "bg-pastel-amber/60",
    chip: "bg-on-amber/15 text-on-amber",
    border: "border-pastel-amber",
    ping: "bg-on-amber/20",
    titleColor: "text-on-amber",
    bodyColor: "text-on-amber/90",
    chipBorder: "border-on-amber/30 bg-on-amber/10 text-on-amber",
  },
  low: {
    wrap: "bg-pastel-sky/60",
    chip: "bg-on-sky/15 text-on-sky",
    border: "border-pastel-sky",
    ping: "bg-on-sky/20",
    titleColor: "text-on-sky",
    bodyColor: "text-on-sky/90",
    chipBorder: "border-on-sky/30 bg-on-sky/10 text-on-sky",
  },
};

export default function AnomalyToast({ anomaly }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [enteredAt, setEnteredAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const visible = anomaly && anomaly.id !== dismissed;
  const tone = anomaly ? severityClasses[anomaly.severity] : severityClasses.high;

  useEffect(() => {
    if (visible && enteredAt === null) setEnteredAt(Date.now());
    if (!anomaly) setEnteredAt(null);
  }, [visible, anomaly, enteredAt]);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!visible || muted) {
      a.pause();
      a.currentTime = 0;
      return;
    }
    a.loop = true;
    a.play().catch(() => {});
  }, [visible, muted, anomaly?.id]);

  useEffect(() => {
    if (!anomaly) {
      setDismissed(null);
      setMuted(false);
    }
  }, [anomaly]);

  const elapsed = enteredAt ? Math.max(0, Math.floor((now - enteredAt) / 1000)) : 0;
  const elapsedLabel =
    elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <>
      <audio ref={audioRef} src="/alert.wav" preload="auto" loop />
      <AnimatePresence>
        {visible && anomaly && (
          <motion.div
            key={anomaly.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            role="alert"
            aria-live="assertive"
            className={cn(
              "pointer-events-auto fixed left-1/2 top-20 z-[1500] w-[440px] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-2xl border bg-card shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)]",
              tone.border
            )}
          >
            <div className={cn("relative flex items-start gap-3 px-4 py-3", tone.wrap)}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.chip)}>
                <span className={cn("absolute h-10 w-10 animate-ping rounded-xl", tone.ping)} />
                <Brain className="relative size-5" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-center gap-2">
                  <p className={cn("text-sm font-semibold", tone.titleColor)}>
                    AI anomaly · {anomaly.severity}
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      tone.chipBorder
                    )}
                  >
                    Live · {elapsedLabel}
                  </span>
                </div>
                <p className={cn("mt-1 text-xs", tone.bodyColor)}>{anomaly.reason}</p>
              </div>
              <button
                onClick={() => setDismissed(anomaly.id)}
                aria-label="Dismiss alert"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                  tone.titleColor,
                  "hover:bg-black/5"
                )}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 bg-card px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                {muted ? (
                  <>Audio muted · alert visible until dismissed</>
                ) : (
                  <>Alert beeping · mute or dismiss to silence</>
                )}
              </p>
              <button
                onClick={() => setMuted((m) => !m)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent/60"
              >
                {muted ? <Bell className="size-3" /> : <BellOff className="size-3" />}
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
