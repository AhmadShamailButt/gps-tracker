import { Anomaly, BreachEvent, Location, Zone } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}

export function getLocations(): Promise<Location[]> {
  return http<Location[]>("/getLocations");
}

export function getZones(): Promise<Zone[]> {
  return http<Zone[]>("/getZones");
}

export function saveZone(zone: Zone): Promise<Zone> {
  return http<Zone>("/saveZone", { method: "POST", body: JSON.stringify(zone) });
}

export function deleteZone(id: string): Promise<{ id: string }> {
  return http<{ id: string }>(`/deleteZone?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getBreaches(): Promise<BreachEvent[]> {
  return http<BreachEvent[]>("/getBreaches");
}

export function saveBreach(breach: BreachEvent): Promise<BreachEvent> {
  return http<BreachEvent>("/saveBreach", {
    method: "POST",
    body: JSON.stringify(breach),
  });
}

export function getAnomalies(): Promise<Anomaly[]> {
  return http<Anomaly[]>("/getAnomalies");
}

export function saveAnomaly(anomaly: Anomaly): Promise<Anomaly> {
  return http<Anomaly>("/saveAnomaly", {
    method: "POST",
    body: JSON.stringify(anomaly),
  });
}

export function clearBreaches(): Promise<{ deleted: number }> {
  return http<{ deleted: number }>("/clearBreaches", { method: "DELETE" });
}

export function clearAnomalies(): Promise<{ deleted: number }> {
  return http<{ deleted: number }>("/clearAnomalies", { method: "DELETE" });
}
