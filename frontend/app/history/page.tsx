"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Gauge,
  History as HistoryIcon,
  LogOut,
  MapPin,
  PauseCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import {
  Anomaly,
  AnomalySeverity,
  AnomalyType,
  BreachEvent,
} from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { connectMqtt } from "@/lib/mqtt";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";

const ANOMALY_CAP = 200;

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

function fmtDuration(fromIso: string, toIso: string | null, nowMs: number) {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : nowMs;
  const sec = Math.max(0, Math.floor((to - from) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

const anomalyIcon: Record<AnomalyType, typeof Zap> = {
  pattern_outlier: Zap,
  abnormal_speed: Gauge,
  unexpected_stop: PauseCircle,
  teleportation: MapPin,
};

const anomalyLabel: Record<AnomalyType, string> = {
  pattern_outlier: "Pattern outlier",
  abnormal_speed: "Abnormal speed",
  unexpected_stop: "Unexpected stop",
  teleportation: "Position jump",
};

const sevTone: Record<AnomalySeverity, "rose" | "amber" | "sky"> = {
  high: "rose",
  medium: "amber",
  low: "sky",
};

type Tab = "breaches" | "anomalies";

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("breaches");
  const [breaches, setBreaches] = useState<BreachEvent[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(() => {
    Promise.all([
      api.getBreaches().catch(() => []),
      api.getAnomalies().catch(() => []),
    ]).then(([b, a]) => {
      const sortedB = [...b].sort(
        (x, y) =>
          new Date(y.enteredAt).getTime() - new Date(x.enteredAt).getTime()
      );
      const sortedA = [...a]
        .sort(
          (x, y) =>
            new Date(y.detectedAt).getTime() - new Date(x.detectedAt).getTime()
        )
        .slice(0, ANOMALY_CAP);
      setBreaches(sortedB);
      setAnomalies(sortedA);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let client: ReturnType<typeof connectMqtt> | null = null;
    try {
      client = connectMqtt({
        onStatus: () => {},
        onTelemetry: () => {},
        onAnomaly: (a) => {
          setAnomalies((prev) => [a, ...prev].slice(0, ANOMALY_CAP));
        },
      });
    } catch {
      // ignore
    }
    return () => {
      client?.end(true);
    };
  }, []);

  const breachStats = useMemo(() => {
    const total = breaches.length;
    const restricted = breaches.filter(
      (b) => b.reason === "inside-restricted"
    ).length;
    const allowed = breaches.filter((b) => b.reason === "outside-allowed").length;
    const ongoing = breaches.filter((b) => !b.clearedAt).length;
    return { total, restricted, allowed, ongoing };
  }, [breaches]);

  const anomalyStats = useMemo(() => {
    const total = anomalies.length;
    const high = anomalies.filter((a) => a.severity === "high").length;
    const medium = anomalies.filter((a) => a.severity === "medium").length;
    const low = anomalies.filter((a) => a.severity === "low").length;
    return { total, high, medium, low };
  }, [anomalies]);

  const clearBreaches = async () => {
    if (!confirm("Delete all breach history from the server? This cannot be undone.")) return;
    setBreaches([]);
    try {
      await api.clearBreaches();
    } catch (e) {
      console.warn("clearBreaches failed:", e);
      refresh();
    }
  };
  const clearAnomalies = async () => {
    if (!confirm("Delete all anomaly history from the server? This cannot be undone.")) return;
    setAnomalies([]);
    try {
      await api.clearAnomalies();
    } catch (e) {
      console.warn("clearAnomalies failed:", e);
      refresh();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-end justify-between gap-4 border-b border-border/60 px-8 pb-5 pt-7">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Audit log
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              History
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Geofence breaches and AI anomalies — full timestamps, durations, locations.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={tab === "breaches" ? clearBreaches : clearAnomalies}
            disabled={
              tab === "breaches" ? breaches.length === 0 : anomalies.length === 0
            }
          >
            <Trash2 className="size-3.5" />
            Clear {tab}
          </Button>
        </header>

        <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-8 py-3">
          <TabButton
            active={tab === "breaches"}
            onClick={() => setTab("breaches")}
            count={breachStats.total}
            label="Geofence breaches"
            icon={<ShieldAlert className="size-3.5" />}
          />
          <TabButton
            active={tab === "anomalies"}
            onClick={() => setTab("anomalies")}
            count={anomalyStats.total}
            label="AI anomalies"
            icon={<Sparkles className="size-3.5" />}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {tab === "breaches" ? (
            <BreachesView events={breaches} stats={breachStats} now={now} />
          ) : (
            <AnomaliesView events={anomalies} stats={anomalyStats} />
          )}
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "rose" | "amber" | "sky" | "green";
}) {
  const toneClass: Record<typeof tone, string> = {
    default: "bg-muted/50 text-foreground",
    rose: "bg-pastel-rose/60 text-on-rose",
    amber: "bg-pastel-amber/60 text-on-amber",
    sky: "bg-pastel-sky/60 text-on-sky",
    green: "bg-pastel-green/60 text-on-green",
  };
  return (
    <div className={cn("rounded-xl border border-border/60 px-4 py-3", toneClass[tone])}>
      <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function BreachesView({
  events,
  stats,
  now,
}: {
  events: BreachEvent[];
  stats: { total: number; restricted: number; allowed: number; ongoing: number };
  now: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total events" value={stats.total} />
        <StatCard label="Entered restricted" value={stats.restricted} tone="rose" />
        <StatCard label="Left allowed" value={stats.allowed} tone="amber" />
        <StatCard label="Currently active" value={stats.ongoing} tone={stats.ongoing > 0 ? "rose" : "green"} />
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="size-5 text-muted-foreground" />}
          title="No breaches recorded yet"
          description="Trigger a breach by moving the device into a Restricted zone or out of all Allowed zones — events are saved to Cosmos DB and shared across every browser."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-left font-medium">Zone</th>
                <th className="px-4 py-2.5 text-left font-medium">Entered</th>
                <th className="px-4 py-2.5 text-left font-medium">Cleared</th>
                <th className="px-4 py-2.5 text-left font-medium">Duration</th>
                <th className="px-4 py-2.5 text-left font-medium">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {events.map((e) => {
                const restricted = e.reason === "inside-restricted";
                const Icon = restricted ? ShieldAlert : LogOut;
                const entered = fmtDateTime(e.enteredAt);
                const cleared = e.clearedAt ? fmtDateTime(e.clearedAt) : null;
                return (
                  <tr key={e.id} className="hover:bg-accent/20">
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold",
                          restricted
                            ? "bg-pastel-rose/70 text-on-rose"
                            : "bg-pastel-amber/70 text-on-amber"
                        )}
                      >
                        <Icon className="size-3" />
                        {restricted ? "Entered" : "Left allowed"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{e.zoneName}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      <div className="text-foreground">{entered.time}</div>
                      <div className="text-[11px]">{entered.date}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {cleared ? (
                        <>
                          <div className="text-foreground">{cleared.time}</div>
                          <div className="text-[11px]">{cleared.date}</div>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pastel-rose/60 px-2 py-0.5 text-[10px] font-semibold text-on-rose">
                          <span className="size-1.5 animate-pulse rounded-full bg-on-rose" />
                          Ongoing
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {fmtDuration(e.enteredAt, e.clearedAt, now)}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground tabular-nums">
                      {e.lat.toFixed(5)}, {e.lng.toFixed(5)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnomaliesView({
  events,
  stats,
}: {
  events: Anomaly[];
  stats: { total: number; high: number; medium: number; low: number };
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="High severity" value={stats.high} tone="rose" />
        <StatCard label="Medium" value={stats.medium} tone="amber" />
        <StatCard label="Low" value={stats.low} tone="sky" />
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-5 text-muted-foreground" />}
          title="No anomalies recorded yet"
          description="Run python anomaly_detector.py from the backend folder, then publish a high-speed reading via mosquitto_pub. Each detected anomaly is saved to Cosmos DB."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-left font-medium">Reason</th>
                <th className="px-4 py-2.5 text-left font-medium">Severity</th>
                <th className="px-4 py-2.5 text-left font-medium">Score</th>
                <th className="px-4 py-2.5 text-left font-medium">Detected</th>
                <th className="px-4 py-2.5 text-left font-medium">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {events.map((a) => {
                const Icon = anomalyIcon[a.type];
                const det = fmtDateTime(a.detectedAt);
                return (
                  <tr key={a.id} className="hover:bg-accent/20">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/70 px-2 py-1 text-[11px] font-medium">
                        <Icon className="size-3" />
                        {anomalyLabel[a.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.reason}</td>
                    <td className="px-4 py-3">
                      <Badge tone={sevTone[a.severity]} className="px-2 py-0.5">
                        {a.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {a.score.toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      <div className="text-foreground">{det.time}</div>
                      <div className="text-[11px]">{det.date}</div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground tabular-nums">
                      {a.lat.toFixed(5)}, {a.lng.toFixed(5)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
        {icon}
      </span>
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

