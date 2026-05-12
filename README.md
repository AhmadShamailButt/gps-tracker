# GPS Tracker

Real-time GPS asset tracking with a live web dashboard, geofencing, and AI-powered anomaly detection.

An ESP32 with a NEO-6M GPS module publishes telemetry to Azure IoT Hub over MQTT/TLS. A Next.js dashboard subscribes to a Mosquitto broker and renders the asset live on an OpenStreetMap map, while a Python engine subscribes to the same broker and flags abnormal trajectories using Isolation Forest plus deterministic rules. Geofence polygons, breach history, and anomaly history all persist in Azure Cosmos DB.

---

## Table of contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Hardware](#hardware)
- [MQTT topics & payloads](#mqtt-topics--payloads)
- [Azure services](#azure-services)
- [Full Azure setup (from zero)](#full-azure-setup-from-zero)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Verifying the pipeline](#verifying-the-pipeline)
- [Anomaly engine — tunable parameters](#anomaly-engine--tunable-parameters)
- [Dashboard features](#dashboard-features)
- [Tech stack](#tech-stack)
- [Troubleshooting](#troubleshooting)
- [Per-folder docs](#per-folder-docs)
- [License](#license)

---

## Highlights

- **Live map** — OpenStreetMap + Leaflet, sub-second marker updates over MQTT/WebSockets
- **Draw your own geofences** — polygon zones tagged as Restricted or Allowed, persisted in Cosmos DB
- **Real-time breach alerts** — visual banner, looping audio beep, dismissible toast, and full breach history
- **AI anomaly engine** — Isolation Forest (scikit-learn) plus three deterministic rules (speed, teleportation, unexpected stop)
- **MQTT-only live data** — dashboard subscribes to the broker directly; REST only for cold-load history and zone CRUD
- **Light / dark theme** with smooth animations (Framer Motion) and a pastel design system
- **History page** with date / time / duration / location columns and clear-all admin actions

---

## Architecture

```
ESP32 (NEO-6M GPS)
   │  MQTT/TLS — port 8883, per-device SAS token
   ▼
Azure IoT Hub ──Message Routing──▶ Cosmos DB (locations, zones, breaches, anomalies)
   │                                       ▲       ▲
   │ Event Hub events                      │       │ HTTPS via Azure Functions
   ▼                                       │       │
Azure Function: iotToMosquitto             │       │
   │  republishes to gps/<id>/telemetry    │       │
   ▼                                       │       │
Mosquitto broker (WSS :8443 / TCP :1883)   │       │
   │                                       │       │
   ├──▶ frontend  (browser, MQTT.js) ──────┘       │
   │                                               │
   └──▶ backend   (Python, paho-mqtt) ─────────────┘
              │  publishes to gps/<id>/anomaly
              ▼
       frontend receives anomaly stream over MQTT
       → toast + History page row
```

Four Cosmos containers in database `gpsdb`:

| Container | Purpose |
| --- | --- |
| `locations` | Every GPS reading (written by IoT Hub Message Routing) |
| `zones` | Geofence polygons drawn from the dashboard |
| `breaches` | Open / closed geofence breach events |
| `anomalies` | AI-flagged anomalies from the Python engine |

---

## Repository layout

```
gps-tracker/
├─ arduino_code/             ESP32 firmware (Arduino IDE)
│   └─ arduino_code.ino
├─ backend/                  Python anomaly engine
│   ├─ anomaly_detector.py
│   ├─ pyproject.toml
│   ├─ .env.example
│   └─ README.md
├─ frontend/                 Next.js dashboard + Azure Functions source
│   ├─ app/                  App Router pages (dashboard, history)
│   ├─ components/           UI: MapView, AlertToast, BreachTracker, Sidebar, …
│   ├─ lib/                  mqtt.ts, api.ts, geofence.ts, types.ts
│   ├─ azure-functions/      10 HTTP + 1 Event Hub trigger
│   └─ public/               Icons, alert.wav
└─ README.md
```

---

## Hardware

| Component | Role |
| --- | --- |
| ESP32 DevKit | WiFi + MQTT publisher |
| NEO-6M GPS module | Lat / lng / speed / satellites over UART |
| Green LED (GPIO 2) | Solid green = normal |
| Red LED (GPIO 4) | On during alert state |
| KY-012 buzzer (GPIO 5) | Pulses every 500 ms during alert |
| SG90 servo (GPIO 18) | 0° normal, 180° during alert |
| SSD1306 OLED *(optional)* | Local lat / lng / speed readout |

Firmware lives at [`arduino_code/arduino_code.ino`](./arduino_code/arduino_code.ino). It connects to WiFi, opens a TLS MQTT session against IoT Hub on port 8883 using a per-device SAS token, and publishes JSON every 10 seconds.

---

## MQTT topics & payloads

### ESP32 → Azure IoT Hub

- **Protocol:** MQTT v3.1.1 over TLS, port 8883
- **Auth:** per-device SAS token
- **Topic:** `devices/<deviceId>/messages/events/`
- **Payload:**

```json
{
  "deviceId": "gps-tracker-1",
  "lat": 31.5087,
  "lng": 74.3501,
  "speed": 12.5,
  "satellites": 13,
  "alert": false,
  "ts": "2026-05-12T10:15:00Z"
}
```

### IoT Hub → Mosquitto (`iotToMosquitto` Function)

- Event Hub trigger on IoT Hub's built-in events endpoint
- Republishes to `gps/<deviceId>/telemetry` on Mosquitto
- Mosquitto ports: `1883` (plain TCP, used by Python) and `8443` (WSS, used by browser)
- Demo auth: anonymous, QoS 0

### Python anomaly engine

| Direction | Topic | Notes |
| --- | --- | --- |
| Subscribes | `gps/+/telemetry` | All devices |
| Publishes | `gps/<deviceId>/anomaly` | Per-device anomaly events |

Anomaly payload:

```json
{
  "id": "anom-1a2b3c4d",
  "deviceId": "gps-tracker-1",
  "type": "abnormal_speed",
  "severity": "high",
  "score": 1.25,
  "reason": "Speed 150.0 km/h exceeds 120 km/h threshold",
  "lat": 31.50889,
  "lng": 74.35010,
  "ts": "2026-05-12T18:15:33Z",
  "detectedAt": "2026-05-12T18:15:34Z"
}
```

---

## Azure services

| Service | Resource (example) | Purpose |
| --- | --- | --- |
| Azure IoT Hub (Free tier) | `gps-tracker-hub` | Secure MQTT broker for ESP32 |
| Azure Cosmos DB (NoSQL) | `gpsdb` | 4 containers, partition key `/id` |
| Azure Functions (Node v4) | `gps-tracker-api-…` | HTTP API + IoT-to-Mosquitto bridge |
| Azure Container Instance | `gps-mqtt-…` (Southeast Asia) | Eclipse Mosquitto broker |
| Azure Storage Account | auto-created | Function App runtime metadata |
| Application Insights | auto-created | Function logs and traces |

### Azure Functions (11 total)

| Function | Trigger | What it does |
| --- | --- | --- |
| `getLocations` | HTTP GET | Last 100 locations (Cosmos query) |
| `getZones` | HTTP GET | All geofence zones |
| `saveZone` | HTTP POST | Upsert zone polygon |
| `deleteZone` | HTTP DELETE | Delete zone by id |
| `getBreaches` | HTTP GET | All breach events |
| `saveBreach` | HTTP POST | Upsert breach (open or cleared) |
| `clearBreaches` | HTTP DELETE | Wipe all breaches (admin) |
| `getAnomalies` | HTTP GET | All anomaly records |
| `saveAnomaly` | HTTP POST | Upsert anomaly |
| `clearAnomalies` | HTTP DELETE | Wipe all anomalies (admin) |
| `iotToMosquitto` | Event Hub | Bridge: IoT Hub events → Mosquitto |

---

## Full Azure setup (from zero)

Skip this section if you're plugging into an already-provisioned environment and only need to run the dashboard / engine locally. The commands below assume the [Azure CLI](https://learn.microsoft.com/cli/azure/) is installed and you're logged in (`az login`).

Pick a resource group + region once and reuse them:

```bash
RG=gps-tracker-rg
LOC=southeastasia
az group create -n $RG -l $LOC
```

### 1. Azure IoT Hub (Free tier)

```bash
az iot hub create -n gps-tracker-hub -g $RG --sku F1 --partition-count 2
az iot hub device-identity create --hub-name gps-tracker-hub --device-id gps-tracker-1
```

Generate a SAS token for the device (paste into `arduino_code.ino`):

```bash
az iot hub generate-sas-token --hub-name gps-tracker-hub --device-id gps-tracker-1 --duration 31536000
```

### 2. Cosmos DB (NoSQL)

```bash
COSMOS=gps-tracker-cosmos-$RANDOM
az cosmosdb create -n $COSMOS -g $RG --kind GlobalDocumentDB --default-consistency-level Session
az cosmosdb sql database create -a $COSMOS -g $RG -n gpsdb

for C in locations zones breaches anomalies; do
  az cosmosdb sql container create -a $COSMOS -g $RG -d gpsdb -n $C \
    --partition-key-path /id --throughput 400
done
```

Add a Cosmos write path from IoT Hub: in the portal, go to **IoT Hub → Message routing → Custom endpoints → Cosmos DB** and target the `locations` container.

Grab the Cosmos connection string for the Function App:

```bash
COSMOS_CONN=$(az cosmosdb keys list -n $COSMOS -g $RG --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv)
```

### 3. Mosquitto broker (Azure Container Instance)

```bash
MOSQ=gps-mqtt-$RANDOM
az container create -g $RG -n $MOSQ \
  --image eclipse-mosquitto:2 \
  --ports 1883 8443 \
  --dns-name-label $MOSQ \
  --os-type Linux \
  --restart-policy OnFailure
```

For demo / course use, anonymous access on 1883 (TCP) and 8443 (WSS) works out of the box. For production, add a config file via a mounted Azure File share that enables `password_file` and `listener 8443` with WSS + TLS.

The hostname for env vars is then `<MOSQ>.<LOC>.azurecontainer.io`.

### 4. Azure Functions (HTTP API + Event Hub bridge)

Install [Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local).

```bash
APP=gps-tracker-api-$RANDOM
STG=gpstrackerstg$RANDOM
az storage account create -n $STG -g $RG -l $LOC --sku Standard_LRS
az functionapp create -g $RG -n $APP --storage-account $STG \
  --runtime node --runtime-version 20 --functions-version 4 \
  --consumption-plan-location $LOC --os-type Linux

# Cosmos connection string (used by all HTTP functions)
az functionapp config appsettings set -g $RG -n $APP \
  --settings "COSMOS_CONN_STRING=$COSMOS_CONN"

# IoT Hub events endpoint (used by iotToMosquitto Event Hub trigger)
IOT_CONN=$(az iot hub connection-string show -n gps-tracker-hub \
  --default-eventhub --query connectionString -o tsv)
az functionapp config appsettings set -g $RG -n $APP \
  --settings "IOTHUB_EVENT_CONNECTION=$IOT_CONN" \
             "MOSQUITTO_HOST=$MOSQ.$LOC.azurecontainer.io" \
             "MOSQUITTO_PORT=1883"

# Permissive CORS for the dashboard
az functionapp cors add -g $RG -n $APP --allowed-origins "*"
```

Deploy the source from this repo:

```bash
cd frontend/azure-functions
npm install
func azure functionapp publish $APP
```

Verify deployment:

```bash
curl https://$APP.azurewebsites.net/api/getLocations
```

> **Heads-up:** if any single function (e.g. `iotToMosquitto`) starts up with a missing app setting, the whole Function App host crashes and every other endpoint returns 503. Always set `IOTHUB_EVENT_CONNECTION` before / immediately after publishing.

### 5. Wire the dashboard

Fill in `frontend/.env.local` with the values above:

```bash
NEXT_PUBLIC_API_BASE=https://$APP.azurewebsites.net/api
NEXT_PUBLIC_MQTT_URL=wss://$MOSQ.$LOC.azurecontainer.io:8443/mqtt
```

### 6. Wire the anomaly engine

Fill in `backend/.env`:

```bash
MQTT_HOST=$MOSQ.$LOC.azurecontainer.io
MQTT_PORT=1883
```

### 7. Flash the ESP32

In `arduino_code/arduino_code.ino` replace:

- `ssid` / `password` with your WiFi credentials
- `iotHubHost` with `gps-tracker-hub.azure-devices.net`
- `deviceId` with `gps-tracker-1`
- `sasToken` with the SAS string generated in step 1

Install the libraries (Library Manager): `PubSubClient`, `ArduinoJson`, `TinyGPSPlus`, `ESP32Servo`. Compile and upload to the board.

You're done. Run the dashboard and engine (see [Quick start](#quick-start)).

---

## Quick start

You'll need **two terminals**: one for the dashboard, one for the AI engine. (Three if you also want a CLI to publish test messages.)

### Terminal 1 — frontend dashboard

```bash
cd frontend
cp .env.example .env.local      # then fill in Azure URLs
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

### Terminal 2 — Python anomaly engine

```bash
cd backend
uv sync                         # creates .venv, installs paho-mqtt, scikit-learn, numpy
cp .env.example .env            # then fill in Mosquitto host
uv run python anomaly_detector.py
```

The engine prints colored per-reading output. The dashboard's anomaly toast and History page update within ~1s of any detection.

### Optional — ESP32 firmware

Open [`arduino_code/arduino_code.ino`](./arduino_code/arduino_code.ino) in the Arduino IDE, set your WiFi SSID/password and IoT Hub SAS token at the top of the file, install the required libraries (`PubSubClient`, `ArduinoJson`, `TinyGPSPlus`, `ESP32Servo`), and flash to the board.

---

## Environment variables

### `frontend/.env.local`

```bash
NEXT_PUBLIC_API_BASE=https://<your-functionapp>.azurewebsites.net/api
NEXT_PUBLIC_MQTT_URL=wss://<your-mosquitto-host>:8443/mqtt
NEXT_PUBLIC_MQTT_TOPIC=gps/+/telemetry
NEXT_PUBLIC_MQTT_ANOMALY_TOPIC=gps/+/anomaly
# Optional broker auth
# NEXT_PUBLIC_MQTT_USER=
# NEXT_PUBLIC_MQTT_PASS=
```

### `backend/.env`

```bash
MQTT_HOST=<your-mosquitto-host>
MQTT_PORT=1883
# Optional broker auth
# MQTT_USER=
# MQTT_PASS=

# Tunable thresholds (all optional — defaults shown)
SPEED_LIMIT_KMH=120
JUMP_DISTANCE_KM=1.0
JUMP_TIME_SECONDS=10
STATIONARY_MINUTES=30
ISOFOREST_N_ESTIMATORS=100
ISOFOREST_CONTAMINATION=0.05
ISOFOREST_MAX_SAMPLES=64
BUFFER_SIZE=200
MIN_READINGS_BEFORE_ML=30
RETRAIN_EVERY=50
```

---

## Verifying the pipeline

1. With both terminals running, the dashboard's MQTT status dot turns green within ~2 seconds.
2. As the ESP32 publishes (or as you simulate), the marker moves, the trail polyline grows, and the status bar updates.
3. From a third terminal, simulate a high-speed reading directly to Mosquitto:

   ```bash
   mosquitto_pub -h <mosquitto-host> -p 1883 \
     -t gps/gps-tracker-1/telemetry \
     -m '{"deviceId":"gps-tracker-1","lat":31.5,"lng":74.35,"speed":150,"satellites":10}'
   ```

4. The Python engine prints a red `ANOMALY abnormal_speed (high)` line.
5. The dashboard shows a red toast top-right and a new row appears in the History page.
6. Draw a polygon on the map and mark it **Restricted**. Publish a reading inside it — the alert banner + looping beep fire, and a breach is recorded in the History page.
7. Reload the page — zones, breach history, and anomaly history all persist (proves the Cosmos round-trip).

---

## Anomaly engine — tunable parameters

All overridable via `backend/.env`:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `SPEED_LIMIT_KMH` | `120` | Above this → `abnormal_speed` (high) |
| `JUMP_DISTANCE_KM` / `JUMP_TIME_SECONDS` | `1.0` / `10` | Position jump → `teleportation` (medium) |
| `STATIONARY_MINUTES` | `30` | Long stillness → `unexpected_stop` (medium) |
| `ISOFOREST_N_ESTIMATORS` | `100` | Trees in Isolation Forest |
| `ISOFOREST_CONTAMINATION` | `0.05` | Assumed outlier ratio |
| `ISOFOREST_MAX_SAMPLES` | `64` | Subsample per tree |
| `BUFFER_SIZE` | `200` | Rolling window per device |
| `MIN_READINGS_BEFORE_ML` | `30` | Warmup before ML runs |
| `RETRAIN_EVERY` | `50` | Refit cadence |

Rules run first; the ML model runs only if no rule fires. High-severity threshold: `decision_function < -0.15`.

Feature vector fed into Isolation Forest (per consecutive pair of readings):

```
[ speed,  lat_delta,  lng_delta,  time_delta_seconds ]
```

---

## Dashboard features

- **Live tracker (`/dashboard`)** — interactive map, draw-to-create polygons, click polygon to delete, real-time marker, trail polyline, MQTT status dot, breach banner, MapFilters (toggle trail / zones / anomalies / breaches / severity)
- **History (`/history`)** — two tabs (Geofence breaches, AI anomalies), date / time / duration / location columns, clear-all admin actions
- **Theme toggle** — light / dark with persisted preference
- **Anomaly toast** — animated alert with severity color, auto-dismiss
- **Geofence breach toast** — looping beep until dismissed or breach clears, mute button, live elapsed duration

---

## Tech stack

- **Hardware:** ESP32 DevKit, NEO-6M GPS, status LEDs, KY-012 buzzer, SG90 servo, SSD1306 OLED
- **Cloud:** Azure IoT Hub · Azure Cosmos DB (NoSQL) · Azure Functions (Node v4) · Azure Container Instance (Mosquitto) · Application Insights
- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Leaflet · react-leaflet · MQTT.js · Framer Motion · @turf/turf · lucide-react
- **Backend:** Python · paho-mqtt · scikit-learn · numpy · uv

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Dashboard MQTT dot stays orange/red | Wrong `NEXT_PUBLIC_MQTT_URL` or Mosquitto ACI stopped | Verify `wss://…:8443/mqtt`, check the container instance is running |
| No live updates but dot is green | IoT Hub → Mosquitto bridge function down | Check `iotToMosquitto` logs in Application Insights; confirm `IOTHUB_EVENT_CONNECTION` app setting exists |
| Anomaly engine connects but flags nothing | Buffer hasn't reached `MIN_READINGS_BEFORE_ML` yet | Wait for ≥ 30 readings, or trigger a rule (e.g. speed > 120) to confirm wiring |
| ESP32 won't connect to IoT Hub | SAS token expired | Regenerate the SAS token (the `se=` epoch field is the expiry) and reflash |
| Cosmos returns 503 from any Azure Function | Function App host crashed (missing app setting) | Check the Function App logs; one broken trigger crashes the whole host |
| Breach stays "Ongoing" forever | Open breach not closed when device left zone | History page → "Clear all" or call `clearBreaches` |

---

## Per-folder docs

- [`frontend/README.md`](./frontend/README.md) — dashboard architecture, env vars, Azure setup
- [`backend/README.md`](./backend/README.md) — Python engine, tunable parameters, CLI output

---

## License

MIT.
