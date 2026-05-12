export type Telemetry = {
  deviceId: string;
  lat: number;
  lng: number;
  speed: number;
  satellites: number;
  ts?: string;
};

export type Location = Telemetry & { ts: string };

export type ZoneType = "restricted" | "allowed";

export type Zone = {
  id: string;
  name: string;
  type: ZoneType;
  polygon: [number, number][];
  createdAt: string;
};

export type Breach = {
  zoneId: string | null;
  zoneName: string;
  reason: "inside-restricted" | "outside-allowed";
};

export type BreachEvent = {
  id: string;
  zoneId: string | null;
  zoneName: string;
  reason: "inside-restricted" | "outside-allowed";
  enteredAt: string;
  clearedAt: string | null;
  lat: number;
  lng: number;
};

export function breachKey(b: { zoneId: string | null; reason: string } | null): string | null {
  return b ? `${b.zoneId ?? "outside"}:${b.reason}` : null;
}

export type AnomalyType =
  | "abnormal_speed"
  | "unexpected_stop"
  | "teleportation"
  | "pattern_outlier";

export type AnomalySeverity = "low" | "medium" | "high";

export type Anomaly = {
  id: string;
  deviceId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  score: number;
  reason: string;
  lat: number;
  lng: number;
  ts: string;
  detectedAt: string;
};
