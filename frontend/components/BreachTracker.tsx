"use client";

import { useEffect, useRef, useState } from "react";
import { Anomaly, BreachEvent, Telemetry, Zone, breachKey } from "@/lib/types";
import { connectMqtt } from "@/lib/mqtt";
import { detectBreach, distanceMeters } from "@/lib/geofence";
import * as api from "@/lib/api";
import AnomalyToast from "./AnomalyToast";

const MIN_MOVE_METERS = 50;

export default function BreachTracker() {
  const zonesRef = useRef<Zone[]>([]);
  const openBreachRef = useRef<BreachEvent | null>(null);
  const latestRef = useRef<Telemetry | null>(null);
  const [latestAnomaly, setLatestAnomaly] = useState<Anomaly | null>(null);

  useEffect(() => {
    const fetchZones = () => {
      api
        .getZones()
        .then((zs) => {
          zonesRef.current = zs;
          if (latestRef.current) handleReading(latestRef.current);
        })
        .catch(() => {});
    };

    // Restore the currently-open breach from Cosmos so a page reload
    // doesn't open a duplicate. If multiple opens exist (from prior crashes),
    // close the older ones — only the most recent can plausibly still be live.
    api
      .getBreaches()
      .then((rows) => {
        const opens = rows.filter((r) => !r.clearedAt);
        if (opens.length === 0) return;
        opens.sort((a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime());
        const [keepOpen, ...stale] = opens;
        const nowIso = new Date().toISOString();
        for (const s of stale) {
          api.saveBreach({ ...s, clearedAt: nowIso }).catch(() => {});
        }
        openBreachRef.current = keepOpen;
      })
      .catch(() => {});

    fetchZones();
    const zonesInterval = setInterval(fetchZones, 30_000);

    const handleReading = (msg: Telemetry) => {
      latestRef.current = msg;
      const next = detectBreach(msg, zonesRef.current);
      const open = openBreachRef.current;
      const nextKey = breachKey(next);
      const prevKey = breachKey(open);

      const movedFar =
        !!open &&
        !!next &&
        nextKey === prevKey &&
        distanceMeters(open.lat, open.lng, msg.lat, msg.lng) > MIN_MOVE_METERS;

      if (nextKey === prevKey && !movedFar) return;

      const nowIso = new Date().toISOString();

      if (open) {
        api.saveBreach({ ...open, clearedAt: nowIso }).catch(() => {});
        openBreachRef.current = null;
      }

      if (next) {
        const event: BreachEvent = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `breach-${Date.now()}`,
          zoneId: next.zoneId,
          zoneName: next.zoneName,
          reason: next.reason,
          enteredAt: nowIso,
          clearedAt: null,
          lat: msg.lat,
          lng: msg.lng,
        };
        openBreachRef.current = event;
        api.saveBreach(event).catch(() => {});
      }
    };

    let client: ReturnType<typeof connectMqtt> | null = null;
    try {
      client = connectMqtt({
        onStatus: () => {},
        onTelemetry: handleReading,
        onAnomaly: (a: Anomaly) => {
          api.saveAnomaly(a).catch(() => {});
          setLatestAnomaly(a);
        },
      });
    } catch (e) {
      console.warn("BreachTracker MQTT init failed:", e);
    }

    return () => {
      clearInterval(zonesInterval);
      client?.end(true);
    };
  }, []);

  return <AnomalyToast anomaly={latestAnomaly} />;
}
