"use client";

import { useEffect, useState } from "react";

const VARS = {
  marker: "--map-marker",
  trail: "--map-trail",
  restricted: "--map-zone-restricted",
  allowed: "--map-zone-allowed",
  breach: "--map-breach",
  anomalyHigh: "--map-anomaly-high",
  anomalyMedium: "--map-anomaly-medium",
  anomalyLow: "--map-anomaly-low",
  tileBg: "--map-tile-bg",
  card: "--color-card",
  foreground: "--color-foreground",
  mutedForeground: "--color-muted-foreground",
} as const;

export type MapColors = Record<keyof typeof VARS, string>;

const FALLBACKS: MapColors = {
  marker: "#6366f1",
  trail: "#6366f1",
  restricted: "#dc2626",
  allowed: "#16a34a",
  breach: "#dc2626",
  anomalyHigh: "#dc2626",
  anomalyMedium: "#f59e0b",
  anomalyLow: "#3b82f6",
  tileBg: "#f8fafc",
  card: "#ffffff",
  foreground: "#0f172a",
  mutedForeground: "#64748b",
};

export function useMapColors(): MapColors {
  const [colors, setColors] = useState<MapColors>(FALLBACKS);

  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      const next = { ...FALLBACKS };
      for (const [key, varName] of Object.entries(VARS)) {
        const v = style.getPropertyValue(varName).trim();
        if (v) next[key as keyof MapColors] = v;
      }
      setColors(next);
    };
    read();

    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return colors;
}
