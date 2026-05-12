"use client";

import { memo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, MapPin, Satellite, AlertTriangle } from "lucide-react";
import { Breach, Location } from "@/lib/types";
import { MqttStatus, mqttStatusMeta } from "@/lib/mqtt";
import { StatusDot } from "@/components/ui/StatusDot";

type Props = {
  latest: Location | null;
  breach: Breach | null;
  mqttStatus: MqttStatus;
};

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-xs font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  );
}

function FloatingTelemetry({ latest, breach, mqttStatus }: Props) {
  const [now, setNow] = useState(Date.now());
  const hasTimestamp = !!latest?.ts;
  useEffect(() => {
    if (!hasTimestamp) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasTimestamp]);

  const ageSec = latest?.ts
    ? Math.max(0, Math.floor((now - new Date(latest.ts).getTime()) / 1000))
    : null;
  const meta = mqttStatusMeta[mqttStatus];

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-[400] flex flex-col gap-2">
      <AnimatePresence>
        {breach && (
          <motion.div
            key={`${breach.zoneId}-${breach.reason}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 rounded-full border border-pastel-rose/80 bg-pastel-rose/60 px-3 py-1.5 text-xs font-medium text-on-rose backdrop-blur"
          >
            <AlertTriangle className="size-3.5" />
            <span>
              Breach: <strong>{breach.zoneName}</strong>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/85 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <StatusDot tone={meta.tone} pulse={meta.pulse} />
          <span className="text-xs font-medium">{meta.label}</span>
        </div>
        {latest ? (
          <>
            <span className="h-6 w-px bg-border/60" />
            <Stat icon={MapPin} label="Lat" value={latest.lat.toFixed(5)} />
            <Stat icon={MapPin} label="Lng" value={latest.lng.toFixed(5)} />
            <Stat
              icon={Activity}
              label="Speed"
              value={`${latest.speed?.toFixed?.(1) ?? "—"} km/h`}
            />
            <Stat icon={Satellite} label="Sats" value={`${latest.satellites ?? "—"}`} />
            {ageSec !== null && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {ageSec}s ago
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Waiting for first message…</span>
        )}
      </div>
    </div>
  );
}

export default memo(FloatingTelemetry);
