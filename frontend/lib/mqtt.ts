"use client";

import mqtt, { MqttClient } from "mqtt";
import { Anomaly, Telemetry } from "./types";

export type MqttStatus = "connecting" | "connected" | "disconnected" | "error";

export type MqttStatusMeta = {
  tone: "green" | "amber" | "red" | "gray";
  label: string;
  pulse?: boolean;
};

export const mqttStatusMeta: Record<MqttStatus, MqttStatusMeta> = {
  connected: { tone: "green", label: "Live", pulse: true },
  connecting: { tone: "amber", label: "Connecting" },
  disconnected: { tone: "gray", label: "Offline" },
  error: { tone: "red", label: "Error" },
};

export type MqttHandlers = {
  onTelemetry: (msg: Telemetry) => void;
  onAnomaly: (msg: Anomaly) => void;
  onStatus: (status: MqttStatus) => void;
};

function isAnomalyShape(o: unknown): o is Anomaly {
  if (!o || typeof o !== "object") return false;
  const a = o as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.type === "string" &&
    typeof a.severity === "string" &&
    typeof a.lat === "number" &&
    typeof a.lng === "number"
  );
}

function isTelemetryShape(o: unknown): o is Telemetry {
  if (!o || typeof o !== "object") return false;
  const t = o as Record<string, unknown>;
  return (
    typeof t.deviceId === "string" &&
    typeof t.lat === "number" &&
    typeof t.lng === "number"
  );
}

type SharedClient = {
  client: MqttClient;
  handlers: Set<MqttHandlers>;
  lastStatus: MqttStatus;
};

// Stash on globalThis so HMR re-uses the same socket instead of leaking one per edit.
const SHARED_KEY = "__gpsMqttShared" as const;
type GlobalWithShared = typeof globalThis & { [SHARED_KEY]?: SharedClient };

function ensureSharedClient(): SharedClient {
  const g = globalThis as GlobalWithShared;
  const existing = g[SHARED_KEY];
  if (existing) return existing;

  const url = process.env.NEXT_PUBLIC_MQTT_URL;
  const username = process.env.NEXT_PUBLIC_MQTT_USER;
  const password = process.env.NEXT_PUBLIC_MQTT_PASS;
  const telemetryTopic = process.env.NEXT_PUBLIC_MQTT_TOPIC ?? "gps/+/telemetry";
  const anomalyTopic =
    process.env.NEXT_PUBLIC_MQTT_ANOMALY_TOPIC ?? "gps/+/anomaly";

  if (!url) throw new Error("NEXT_PUBLIC_MQTT_URL not set in .env.local");

  const clientId = `gps-web-${Math.random().toString(16).slice(2, 10)}-${Date.now().toString(16).slice(-6)}`;
  const client = mqtt.connect(url, {
    clientId,
    username,
    password,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    keepalive: 30,
    resubscribe: true,
    protocolVersion: 4,
  });

  const handlers = new Set<MqttHandlers>();
  const ctx: SharedClient = { client, handlers, lastStatus: "connecting" };
  g[SHARED_KEY] = ctx;

  const fanStatus = (s: MqttStatus) => {
    ctx.lastStatus = s;
    handlers.forEach((h) => h.onStatus(s));
  };

  client.on("connect", () => {
    fanStatus("connected");
    client.subscribe([telemetryTopic, anomalyTopic], { qos: 0 }, (err) => {
      if (err) fanStatus("error");
    });
  });

  client.on("reconnect", () => fanStatus("connecting"));
  client.on("close", () => fanStatus("disconnected"));
  client.on("error", () => fanStatus("error"));

  client.on("message", (topic, payload) => {
    if (topic === "gps/__selftest__/telemetry") return;
    try {
      const parsed = JSON.parse(payload.toString());
      if (topic.endsWith("/anomaly")) {
        if (isAnomalyShape(parsed)) handlers.forEach((h) => h.onAnomaly(parsed));
      } else if (isTelemetryShape(parsed)) {
        handlers.forEach((h) => h.onTelemetry(parsed));
      }
    } catch {
      return;
    }
  });

  return ctx;
}

type Subscription = { end: (force?: boolean) => void };

export function connectMqtt(handlers: MqttHandlers): Subscription {
  const ctx = ensureSharedClient();
  ctx.handlers.add(handlers);
  // Replay current status so the new subscriber renders correctly immediately
  handlers.onStatus(ctx.lastStatus);

  return {
    end: () => {
      ctx.handlers.delete(handlers);
      // Don't close the socket — another subscriber may still need it.
      // The shared client lives for the page lifetime.
    },
  };
}
