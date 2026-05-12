"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  History,
  LogOut,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { BreachEvent } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItem } from "@/lib/animations";

type Tab = "all" | "restricted" | "allowed";

type Props = {
  events: BreachEvent[];
  onClear: () => void;
};

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return { date, time };
}

function formatDuration(fromIso: string, toIso: string | null, nowMs: number): string {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : nowMs;
  const sec = Math.max(0, Math.floor((to - from) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m ${remSec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

function BreachHistoryPanel({ events, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [now, setNow] = useState(Date.now());

  const hasOpenBreach = events.length > 0 && !events[0].clearedAt;
  useEffect(() => {
    if (!hasOpenBreach) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasOpenBreach]);

  const counts = useMemo(() => {
    const c = { restricted: 0, allowed: 0 };
    for (const e of events) {
      if (e.reason === "inside-restricted") c.restricted++;
      else c.allowed++;
    }
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    if (tab === "all") return events;
    if (tab === "restricted")
      return events.filter((e) => e.reason === "inside-restricted");
    return events.filter((e) => e.reason === "outside-allowed");
  }, [events, tab]);

  return (
    <div className="pointer-events-auto absolute bottom-4 right-20 z-[400] flex w-[360px] flex-col">
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="flex max-h-[480px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/90 backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Audit log
                </p>
                <h2 className="font-display text-base font-semibold tracking-tight">
                  Breach history
                </h2>
              </div>
              <div className="flex items-center gap-1">
                {events.length > 0 && (
                  <button
                    onClick={onClear}
                    aria-label="Clear history"
                    title="Clear history"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Collapse panel"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
            </div>

            <div className="px-5 pt-3">
              <div className="flex items-center gap-1 rounded-lg bg-muted/70 p-1">
                <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
                  All <Pill>{events.length}</Pill>
                </TabBtn>
                <TabBtn
                  active={tab === "restricted"}
                  onClick={() => setTab("restricted")}
                >
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-on-rose" />
                    Entered
                  </span>
                  <Pill>{counts.restricted}</Pill>
                </TabBtn>
                <TabBtn active={tab === "allowed"} onClick={() => setTab("allowed")}>
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-on-amber" />
                    Left
                  </span>
                  <Pill>{counts.allowed}</Pill>
                </TabBtn>
              </div>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto px-3 pb-3">
              {filtered.length === 0 ? (
                <EmptyState hasAny={events.length > 0} />
              ) : (
                <motion.ul
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col gap-1.5"
                >
                  <AnimatePresence>
                    {filtered.map((e) => (
                      <BreachRow key={e.id} event={e} now={now} />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </div>

            <div className="border-t border-border/40 bg-muted/30 px-5 py-2.5">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Stored locally in this browser. Last {events.length}/100 events ·{" "}
                <span className="text-foreground">Restricted entries</span> shown red ·{" "}
                <span className="text-foreground">Allowed exits</span> shown amber.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="reopen"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(true)}
            aria-label="Open breach history"
            className="flex h-10 items-center gap-2 self-end rounded-full border border-border/60 bg-card/90 px-4 backdrop-blur transition-colors hover:bg-accent/60"
          >
            <History className="size-4 text-primary" />
            <span className="text-xs font-medium">History</span>
            <Badge tone={hasOpenBreach ? "rose" : "indigo"} className="px-2 py-0.5">
              {events.length}
            </Badge>
            <ChevronUp className="size-3.5 text-muted-foreground" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
      {children}
    </span>
  );
}

function BreachRow({ event, now }: { event: BreachEvent; now: number }) {
  const restricted = event.reason === "inside-restricted";
  const Icon = restricted ? ShieldAlert : LogOut;
  const tone = restricted ? "rose" : "amber";
  const surface = restricted
    ? "bg-pastel-rose/70 text-on-rose"
    : "bg-pastel-amber/70 text-on-amber";
  const open = !event.clearedAt;
  const entered = formatDateTime(event.enteredAt);
  const cleared = event.clearedAt ? formatDateTime(event.clearedAt) : null;
  const duration = formatDuration(event.enteredAt, event.clearedAt, now);

  return (
    <motion.li
      variants={staggerItem}
      layout
      exit={{ opacity: 0, x: 8 }}
      className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2"
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          surface
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{event.zoneName}</p>
          <Badge tone={tone} className="px-1.5 py-0">
            {restricted ? "Entered" : "Left allowed"}
          </Badge>
          {open && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-pastel-rose/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-on-rose">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-on-rose opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-on-rose" />
              </span>
              Live
            </span>
          )}
        </div>
        <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground tabular-nums">
          <span className="uppercase tracking-wider">Entered</span>
          <span className="text-foreground">
            {entered.date} · {entered.time}
          </span>
          <span className="uppercase tracking-wider">{open ? "Now" : "Cleared"}</span>
          <span className="text-foreground">
            {cleared ? `${cleared.date} · ${cleared.time}` : "ongoing"}
          </span>
          <span className="uppercase tracking-wider">Duration</span>
          <span className={cn(open ? "text-on-rose font-medium" : "text-foreground")}>
            {duration}
          </span>
          <span className="uppercase tracking-wider">Location</span>
          <span className="text-foreground">
            {event.lat.toFixed(5)}, {event.lng.toFixed(5)}
          </span>
        </div>
        {!restricted && (
          <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <AlertTriangle className="size-3" />
            Device left every Allowed zone
          </p>
        )}
      </div>
    </motion.li>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="mx-2 mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <History className="size-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">
        {hasAny ? "Nothing matches this filter" : "No breaches yet"}
      </p>
      <p className="max-w-[260px] text-xs text-muted-foreground">
        {hasAny
          ? "Switch tab to see Entered or Left events."
          : "Every time the device enters a Restricted zone or leaves all Allowed zones, it'll appear here with full timestamps."}
      </p>
    </div>
  );
}

export default memo(BreachHistoryPanel);
