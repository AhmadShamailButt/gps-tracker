"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Activity,
  Brain,
  Map as MapIcon,
  Radio,
  Satellite,
  ShieldAlert,
  Sparkles,
  Database,
  Cloud,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { Tone, toneSurface, toneSurfaceSoft } from "@/lib/tones";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Radio,
    title: "Live MQTT telemetry",
    description:
      "ESP32 publishes via MQTT to Azure IoT Hub. The dashboard subscribes through Mosquitto over WSS — pure broker-driven, never polling the device.",
    tone: "indigo" as const,
  },
  {
    icon: MapIcon,
    title: "OpenStreetMap + Leaflet",
    description:
      "Real-time marker, breadcrumb trail, and draggable polygon zones — all rendered on free, open OSM tiles.",
    tone: "sky" as const,
  },
  {
    icon: ShieldAlert,
    title: "Geofence alerts",
    description:
      "Draw restricted or allowed polygons. The browser runs point-in-polygon checks per message and fires visual + audible breach alerts.",
    tone: "rose" as const,
  },
  {
    icon: Brain,
    title: "AI anomaly detection",
    description:
      "Python detector subscribes to the same broker. Rule-based checks (abnormal speed, teleportation, unexpected stop) plus Isolation Forest for pattern outliers.",
    tone: "amber" as const,
  },
  {
    icon: Database,
    title: "Persistent audit log",
    description:
      "Every breach and anomaly is written to Azure Cosmos DB. The /history page surfaces full timestamps, durations, and locations across browsers.",
    tone: "green" as const,
  },
  {
    icon: Cloud,
    title: "Azure-native pipeline",
    description:
      "IoT Hub → Cosmos for cold history. Azure Functions expose zones/breaches/anomalies CRUD over HTTPS. Live data stays on MQTT.",
    tone: "pink" as const,
  },
];

const flowSteps = [
  { label: "ESP32", description: "NEO-6M GPS over UART" },
  { label: "Azure IoT Hub", description: "MQTT broker (TLS 8883)" },
  { label: "Mosquitto", description: "WSS bridge for browsers" },
  { label: "Dashboard", description: "MQTT.js + Leaflet" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="relative overflow-hidden">
        <BackgroundDecoration />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-16 text-center sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Badge tone="indigo" className="mb-6">
              <Sparkles className="size-3" />
              FAST NUCES · IoT Project
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
          >
            GPS tracker with <span className="text-primary">geofence</span> &amp; AI anomaly
            detection
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg"
          >
            ESP32 + NEO-6M streams real-time location through Azure IoT Hub. A live web
            dashboard subscribes via MQTT, draws geofence polygons on OpenStreetMap, and
            raises alerts the moment the device crosses a boundary.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/dashboard">
              <Button size="lg">
                Open dashboard
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline">
                Learn more
              </Button>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <KpiPill label="Update cadence" value="≤ 1s" tone="indigo" />
            <KpiPill label="Map provider" value="OSM" tone="sky" />
            <KpiPill label="Broker" value="MQTT" tone="green" />
            <KpiPill label="AI engine" value="Python" tone="amber" />
          </motion.div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <SectionHeader
          eyebrow="Features"
          title="Everything the proposal requires, in one dashboard"
          description="MQTT-driven live data, drawn-on-the-map geofences, AI anomaly engine, and a hardware status indicator on the device itself."
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((f) => (
            <motion.div key={f.title} variants={staggerItem}>
              <FeatureCard {...f} />
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <SectionHeader
          eyebrow="Architecture"
          title="Pure MQTT for live data, REST only where MQTT can't help"
          description="The dashboard never talks to the ESP32 directly. Live telemetry flows through the broker; historical trail and geofence storage use Azure Functions over HTTPS."
        />

        <Card variant="ghost" size="lg" className="mt-10 bg-card/60">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-2">
            {flowSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3 md:flex-col md:items-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <div className="md:mt-2">
                  <p className="font-display text-sm font-semibold tracking-tight">
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card tone="sky" variant="pastel">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/15 text-info">
                  <Activity className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Live path</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ESP32 → IoT Hub → Mosquitto → browser. ≤ 1s end-to-end.
                  </p>
                </div>
              </div>
            </Card>
            <Card tone="amber" variant="pastel">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/20 text-on-amber">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Alert path</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Browser detects breach client-side and fires a visual + audible alert.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Card variant="pastel" tone="indigo" size="lg">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-indigo">
                Team
              </p>
              <h3 className="mt-1 font-display text-xl font-bold tracking-tight">
                Ezza Abdullah · Ahmad Shamail Butt · Tehreem Tahir
              </h3>
              <p className="mt-1 text-sm text-on-indigo/80">
                FAST NUCES · IoT Course Project · Spring 2026
              </p>
            </div>
            <Link href="/dashboard">
              <Button size="lg">
                Launch the dashboard
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </section>

      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Satellite className="size-4 text-primary" strokeWidth={2.2} />
          </div>
          <span className="font-display text-sm font-semibold tracking-tight">
            GPS Tracker
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/dashboard">
            <Button size="sm">
              Open dashboard
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function BackgroundDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-pastel-indigo/40 blur-3xl" />
      <div className="absolute right-0 top-40 h-[400px] w-[400px] rounded-full bg-pastel-pink/40 blur-3xl" />
      <div className="absolute left-0 top-72 h-[400px] w-[400px] rounded-full bg-pastel-sky/40 blur-3xl" />
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground sm:text-base">{description}</p>
    </div>
  );
}

function KpiPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <div className={cn("rounded-xl px-4 py-3 text-left", toneSurfaceSoft[tone])}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-base font-bold tracking-tight">{value}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: Tone;
}) {
  return (
    <Card size="lg" className="h-full">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneSurface[tone])}>
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </Card>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <p>© 2026 FAST NUCES · GPS Tracker IoT Project</p>
        <p>
          ESP32 · NEO-6M GPS · Azure IoT Hub · Mosquitto · Next.js · Leaflet
        </p>
      </div>
    </footer>
  );
}
