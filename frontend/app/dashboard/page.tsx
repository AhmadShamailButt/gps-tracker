"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Anomaly, Breach, BreachEvent, Location, Telemetry, Zone, ZoneType } from "@/lib/types";
import { connectMqtt, MqttStatus } from "@/lib/mqtt";
import { detectBreach } from "@/lib/geofence";
import * as api from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import FloatingTelemetry from "@/components/FloatingTelemetry";
import AlertToast from "@/components/AlertToast";
import ZoneNameModal from "@/components/ZoneNameModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import MapFilters, { DEFAULT_FILTERS, MapFilterState } from "@/components/MapFilters";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const TRAIL_CAP = 200;
const ANOMALY_CAP = 50;
const BREACH_CAP = 100;

function sameBreaches(a: BreachEvent[], b: BreachEvent[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].clearedAt !== b[i].clearedAt) return false;
  }
  return true;
}

function capBreaches(rows: BreachEvent[]): BreachEvent[] {
  return [...rows]
    .sort((x, y) => new Date(y.enteredAt).getTime() - new Date(x.enteredAt).getTime())
    .slice(0, BREACH_CAP);
}

export default function DashboardPage() {
  const [trail, setTrail] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [breach, setBreach] = useState<Breach | null>(null);
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>("disconnected");
  const [pendingPolygon, setPendingPolygon] = useState<[number, number][] | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [breaches, setBreaches] = useState<BreachEvent[]>([]);
  const [filters, setFilters] = useState<MapFilterState>(DEFAULT_FILTERS);

  const latest: Location | null = trail.length > 0 ? trail[trail.length - 1] : null;

  const visibleAnomalies = filters.layers.anomalies
    ? anomalies.filter((a) => filters.severities[a.severity])
    : [];
  const visibleZones = filters.layers.zones ? zones : [];
  const visibleTrail = filters.layers.trail ? trail : [];
  const visibleBreaches = filters.layers.breaches ? breaches : [];
  const openBreach = useMemo(() => breaches.find((b) => !b.clearedAt) ?? null, [breaches]);

  useEffect(() => {
    Promise.all([
      api.getLocations().catch(() => []),
      api.getZones().catch(() => []),
      api.getAnomalies().catch(() => []),
      api.getBreaches().catch(() => []),
    ]).then(([locs, zs, anoms, brs]) => {
      const now = Date.now();
      const sorted = [...locs]
        .reverse()
        .filter((r) => typeof r.lat === "number" && typeof r.lng === "number")
        .map((r, i, arr) => ({
          ...r,
          ts: r.ts ?? new Date(now - (arr.length - 1 - i) * 10_000).toISOString(),
        }));
      setTrail(sorted.slice(-TRAIL_CAP));
      setZones(zs);
      const recent = [...anoms]
        .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
        .slice(0, ANOMALY_CAP);
      setAnomalies(recent);
      setBreaches(capBreaches(brs));
    });

    const refreshBreaches = () =>
      api
        .getBreaches()
        .then((rows) => {
          const next = capBreaches(rows);
          setBreaches((prev) => (sameBreaches(prev, next) ? prev : next));
        })
        .catch(() => {});
    const t = setInterval(refreshBreaches, 5_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let client: ReturnType<typeof connectMqtt> | null = null;
    try {
      client = connectMqtt({
        onStatus: setMqttStatus,
        onTelemetry: (msg: Telemetry) => {
          const loc: Location = { ...msg, ts: msg.ts ?? new Date().toISOString() };
          setTrail((prev) => {
            const next = [...prev, loc];
            return next.length > TRAIL_CAP ? next.slice(-TRAIL_CAP) : next;
          });
        },
        onAnomaly: (a: Anomaly) => {
          setAnomalies((prev) => [a, ...prev].slice(0, ANOMALY_CAP));
        },
      });
    } catch (e) {
      console.error("MQTT init failed:", e);
    }
    return () => {
      client?.end(true);
    };
  }, []);

  useEffect(() => {
    setBreach(latest ? detectBreach(latest, zones) : null);
  }, [zones, latest]);

  const handlePolygonCreated = useCallback((polygon: [number, number][]) => {
    setPendingPolygon(polygon);
  }, []);

  const handleZoneSubmit = useCallback(
    async (name: string, type: ZoneType) => {
      if (!pendingPolygon) return;
      const zone: Zone = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `zone-${Date.now()}`,
        name,
        type,
        polygon: pendingPolygon,
        createdAt: new Date().toISOString(),
      };
      setPendingPolygon(null);
      try {
        const saved = await api.saveZone(zone);
        setZones((prev) => [...prev, saved]);
      } catch (e) {
        console.warn("saveZone failed, keeping locally:", e);
        setZones((prev) => [...prev, zone]);
      }
    },
    [pendingPolygon]
  );

  const handleDeleteZone = useCallback((zone: Zone) => {
    setZoneToDelete(zone);
  }, []);

  const confirmDeleteZone = useCallback(async () => {
    if (!zoneToDelete) return;
    const zone = zoneToDelete;
    setZoneToDelete(null);
    try {
      await api.deleteZone(zone.id);
    } catch (e) {
      console.warn("deleteZone API failed, removing locally:", e);
    }
    setZones((prev) => prev.filter((z) => z.id !== zone.id));
  }, [zoneToDelete]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="relative flex-1 overflow-hidden">
        <MapView
          trail={visibleTrail}
          latest={latest}
          zones={visibleZones}
          breach={breach}
          anomalies={visibleAnomalies}
          breaches={visibleBreaches}
          onPolygonCreated={handlePolygonCreated}
          onZoneClick={handleDeleteZone}
        />
        <FloatingTelemetry latest={latest} breach={breach} mqttStatus={mqttStatus} />
        <MapFilters value={filters} onChange={setFilters} />
        <AlertToast breach={breach} enteredAtIso={openBreach?.enteredAt ?? null} />
      </main>
      <ZoneNameModal
        open={pendingPolygon !== null}
        onCancel={() => setPendingPolygon(null)}
        onSubmit={handleZoneSubmit}
      />
      <ConfirmDialog
        open={zoneToDelete !== null}
        title={`Delete zone "${zoneToDelete?.name ?? ""}"?`}
        description={
          <>
            This permanently removes the{" "}
            <span className="font-medium text-foreground">
              {zoneToDelete?.type === "restricted" ? "Restricted" : "Allowed"}
            </span>{" "}
            geofence. The dashboard will stop alerting for this area immediately.
          </>
        }
        confirmLabel="Delete zone"
        cancelLabel="Keep"
        destructive
        onConfirm={confirmDeleteZone}
        onCancel={() => setZoneToDelete(null)}
      />
    </div>
  );
}
