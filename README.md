# GPS Tracker

Real-time GPS asset tracking with live web dashboard, geofencing, and AI-powered anomaly detection. ESP32 hardware publishes GPS readings to Azure IoT Hub over MQTT; a Next.js dashboard renders them live on an interactive map, while a Python engine runs Isolation Forest + rule-based checks to flag abnormal trajectories.

## Highlights

- **Live map** — OpenStreetMap + Leaflet, sub-second marker updates over MQTT/WebSockets
- **Draw your own geofences** — polygon zones tagged as Restricted or Allowed, persisted in Cosmos DB
- **Real-time breach alerts** — visual banner, looping audio beep, and breach history log
- **AI anomaly engine** — Isolation Forest (scikit-learn) plus three deterministic rules (speed, teleportation, unexpected stop)
- **MQTT-only live data** — dashboard subscribes to the broker directly; REST only for cold-load history and zone CRUD

## Architecture

```
ESP32 (NEO-6M GPS)
   │  MQTT/TLS (port 8883, per-device SAS token)
   ▼
Azure IoT Hub  ──Message Routing──▶ Cosmos DB (locations, zones, breaches, anomalies)
   │                                       ▲       ▲
   │ Event Hub events                      │       │ HTTPS (Azure Functions)
   ▼                                       │       │
Azure Function: iotToMosquitto             │       │
   │  republishes to gps/<id>/telemetry    │       │
   ▼                                       │       │
Mosquitto broker (WSS :8443 / TCP :1883)   │       │
   │                                       │       │
   ├──▶ frontend (browser, MQTT.js) ───────┘       │
   │                                               │
   └──▶ backend  (Python, paho-mqtt) ──────────────┘
              │  publishes to gps/<id>/anomaly
              ▼
       frontend re-receives anomaly stream
       → toast + History page
```

Four Cosmos containers in database `gpsdb`:

| Container | Purpose |
| --- | --- |
| `locations` | Every GPS reading (written by IoT Hub Message Routing) |
| `zones` | Geofence polygons drawn from the dashboard |
| `breaches` | Open/closed geofence breach events |
| `anomalies` | AI-flagged anomalies from the Python engine |

Eleven Azure Functions back the dashboard: 10 HTTP (zones / breaches / anomalies / locations CRUD) plus 1 Event Hub trigger (`iotToMosquitto` bridge).

## Repository layout

```
gps-tracker/
├─ arduino_code/      ESP32 firmware (Arduino IDE)
├─ backend/           Python anomaly engine (paho-mqtt + Isolation Forest)
└─ frontend/          Next.js 16 dashboard + Azure Functions source
```

## Quick start

You'll need **two terminals**: one for the dashboard, one for the AI engine.

### Terminal 1 — frontend dashboard

```bash
cd frontend
cp .env.example .env.local      # edit Azure URLs if yours differ
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

### Terminal 2 — Python anomaly engine

```bash
cd backend
uv sync                         # creates .venv, installs paho-mqtt, scikit-learn, numpy
cp .env.example .env            # edit Mosquitto host if yours differs
uv run python anomaly_detector.py
```

The engine prints colored per-reading output. The dashboard's anomaly toast and History page update within ~1s of any detection.

## Verifying the pipeline end-to-end

1. With both terminals running, the dashboard's MQTT status dot turns green within a couple of seconds and the marker starts moving as the ESP32 publishes.
2. From a third terminal, simulate a high-speed reading directly to Mosquitto:
   ```bash
   mosquitto_pub -h <mosquitto-host> -p 1883 \
     -t gps/gps-tracker-1/telemetry \
     -m '{"deviceId":"gps-tracker-1","lat":31.5,"lng":74.35,"speed":150,"satellites":10}'
   ```
3. The Python engine prints a red `ANOMALY abnormal_speed (high)` line.
4. The dashboard shows a red toast top-right and appends a new row in the History page.
5. Draw a polygon on the map, mark it Restricted, and publish a reading inside it — the alert banner + looping beep fire, and a breach row is recorded.

## Stack

- **Hardware:** ESP32 DevKit, NEO-6M GPS, status LEDs, KY-012 buzzer, SG90 servo, SSD1306 OLED
- **Cloud:** Azure IoT Hub, Azure Cosmos DB (NoSQL), Azure Functions (Node v4), Azure Container Instance (Mosquitto), Application Insights
- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Leaflet · MQTT.js · Framer Motion · @turf/turf
- **Backend:** Python · paho-mqtt · scikit-learn · numpy · uv

## Anomaly engine — tunable parameters

All overridable via `backend/.env`:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `SPEED_LIMIT_KMH` | 120 | Above this → `abnormal_speed` (high) |
| `JUMP_DISTANCE_KM` / `JUMP_TIME_SECONDS` | 1.0 / 10 | Position jump rule → `teleportation` (medium) |
| `STATIONARY_MINUTES` | 30 | Stationary too long → `unexpected_stop` (medium) |
| `ISOFOREST_N_ESTIMATORS` | 100 | Trees in Isolation Forest |
| `ISOFOREST_CONTAMINATION` | 0.05 | Assumed outlier ratio |
| `ISOFOREST_MAX_SAMPLES` | 64 | Subsample per tree |
| `BUFFER_SIZE` | 200 | Rolling window per device |
| `MIN_READINGS_BEFORE_ML` | 30 | Warmup before ML runs |
| `RETRAIN_EVERY` | 50 | Refit cadence |

Rules run first; the ML model only runs if no rule fires. Score threshold for high severity: `decision_function < -0.15`.

## Per-folder docs

- [`frontend/README.md`](./frontend/README.md) — dashboard architecture, env vars, Azure setup
- [`backend/README.md`](./backend/README.md) — Python engine, tunable parameters, CLI output

## License

MIT.
