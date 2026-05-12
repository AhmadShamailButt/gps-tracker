"use client";

import { Breach, breachKey as makeBreachKey } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, BellOff, ShieldAlert, LogOut, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Props = { breach: Breach | null; enteredAtIso?: string | null };

export default function AlertToast({ breach, enteredAtIso }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [enteredAt, setEnteredAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const breachKey = makeBreachKey(breach);
  const visible = breach && breachKey !== dismissed;

  useEffect(() => {
    if (!visible) {
      setEnteredAt(null);
      return;
    }
    if (enteredAtIso) {
      setEnteredAt(new Date(enteredAtIso).getTime());
    } else if (enteredAt === null) {
      setEnteredAt(Date.now());
    }
  }, [visible, enteredAtIso, enteredAt]);

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
  }, [visible, muted, breachKey]);

  useEffect(() => {
    if (!breach) {
      setDismissed(null);
      setMuted(false);
    }
  }, [breach]);

  const restricted = breach?.reason === "inside-restricted";
  const elapsed = enteredAt ? Math.max(0, Math.floor((now - enteredAt) / 1000)) : 0;
  const elapsedLabel =
    elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <>
      <audio ref={audioRef} src="/alert.wav" preload="auto" loop />
      <AnimatePresence>
        {visible && breach && (
          <motion.div
            key={breachKey}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            role="alert"
            aria-live="assertive"
            className="pointer-events-auto fixed left-1/2 top-20 z-[1500] w-[440px] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-2xl border border-pastel-rose bg-card shadow-[0_20px_60px_-15px_rgba(220,38,38,0.35)]"
          >
            <div className="relative flex items-start gap-3 bg-pastel-rose/60 px-4 py-3">
              <span className="absolute inset-x-0 top-0 h-0.5 bg-on-rose/40" />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-on-rose/15 text-on-rose">
                <span className="absolute h-10 w-10 animate-ping rounded-xl bg-on-rose/20" />
                <AlertTriangle className="relative size-5" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-on-rose">Geofence breach</p>
                  <span className="rounded-full border border-on-rose/30 bg-on-rose/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-rose">
                    Live · {elapsedLabel}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-on-rose/90">
                  {restricted ? (
                    <>
                      <ShieldAlert className="size-3.5 shrink-0" />
                      Device entered restricted zone:{" "}
                      <span className="truncate font-semibold">{breach.zoneName}</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="size-3.5 shrink-0" />
                      Device left every Allowed zone
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setDismissed(breachKey)}
                aria-label="Dismiss alert"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-on-rose/70 transition-colors hover:bg-on-rose/15 hover:text-on-rose"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 bg-card px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                {muted ? (
                  <>Audio muted · alert continues until cleared</>
                ) : (
                  <>Alert beeping · device must leave the zone or you can mute</>
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
