"use client";

import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LayerKey = "trail" | "zones" | "anomalies" | "breaches";
export type SeverityKey = "high" | "medium" | "low";

export type MapFilterState = {
  layers: Record<LayerKey, boolean>;
  severities: Record<SeverityKey, boolean>;
};

export const DEFAULT_FILTERS: MapFilterState = {
  layers: { trail: true, zones: true, anomalies: true, breaches: true },
  severities: { high: true, medium: true, low: true },
};

type Props = {
  value: MapFilterState;
  onChange: (next: MapFilterState) => void;
};

const LAYER_LIST: { key: LayerKey; label: string; tone: string }[] = [
  { key: "trail", label: "Trail", tone: "bg-pastel-sky/70 text-on-sky border-pastel-sky/80" },
  { key: "zones", label: "Zones", tone: "bg-pastel-emerald/70 text-on-emerald border-pastel-emerald/80" },
  { key: "anomalies", label: "Anomalies", tone: "bg-pastel-indigo/70 text-on-indigo border-pastel-indigo/80" },
  { key: "breaches", label: "Breaches", tone: "bg-pastel-rose/70 text-on-rose border-pastel-rose/80" },
];

const SEVERITY_LIST: { key: SeverityKey; label: string; tone: string }[] = [
  { key: "high", label: "High", tone: "bg-pastel-rose/70 text-on-rose border-pastel-rose/80" },
  { key: "medium", label: "Medium", tone: "bg-pastel-amber/70 text-on-amber border-pastel-amber/80" },
  { key: "low", label: "Low", tone: "bg-pastel-sky/70 text-on-sky border-pastel-sky/80" },
];

function MapFilters({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const toggleLayer = (k: LayerKey) =>
    onChange({ ...value, layers: { ...value.layers, [k]: !value.layers[k] } });
  const toggleSev = (k: SeverityKey) =>
    onChange({ ...value, severities: { ...value.severities, [k]: !value.severities[k] } });

  const allOn = (rec: Record<string, boolean>) => Object.values(rec).every(Boolean);
  const anyOff = !allOn(value.layers) || !allOn(value.severities);

  const selectAll = () =>
    onChange({
      layers: { trail: true, zones: true, anomalies: true, breaches: true },
      severities: { high: true, medium: true, low: true },
    });
  const clearAll = () =>
    onChange({
      layers: { trail: false, zones: false, anomalies: false, breaches: false },
      severities: { high: false, medium: false, low: false },
    });

  return (
    <div className="pointer-events-auto absolute right-4 top-20 z-[400] flex w-[300px] flex-col">
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Map filters
                </p>
                <h2 className="font-display text-base font-semibold tracking-tight">
                  Filters
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-5 pt-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Layers
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LAYER_LIST.map((l) => (
                  <Chip
                    key={l.key}
                    label={l.label}
                    tone={l.tone}
                    active={value.layers[l.key]}
                    onClick={() => toggleLayer(l.key)}
                  />
                ))}
              </div>
            </div>

            <div className="px-5 pt-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Severity
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SEVERITY_LIST.map((s) => (
                  <Chip
                    key={s.key}
                    label={s.label}
                    tone={s.tone}
                    active={value.severities[s.key]}
                    onClick={() => toggleSev(s.key)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-border/40 bg-muted/30 px-5 py-3">
              <button
                onClick={selectAll}
                className="text-[11px] font-medium text-foreground transition-colors hover:text-primary"
              >
                Select all
              </button>
              <span className="text-muted-foreground/50">·</span>
              <button
                onClick={clearAll}
                className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="reopen"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(true)}
            aria-label="Open filters"
            className="flex h-10 items-center gap-2 self-end rounded-full border border-border/60 bg-card/90 px-4 backdrop-blur transition-colors hover:bg-accent/60"
          >
            <Filter className="size-4 text-primary" />
            <span className="text-xs font-medium">Filters</span>
            {anyOff && (
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        active
          ? cn(tone, "shadow-sm")
          : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
      )}
    >
      {active && <Check className="size-3" strokeWidth={3} />}
      {label}
    </button>
  );
}

export default memo(MapFilters);
