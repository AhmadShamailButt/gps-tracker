# GPS Tracker Web Dashboard

Next.js + MQTT.js + Leaflet dashboard for the FAST NUCES IoT GPS tracker project.

## Architecture

```
ESP32 (NEO-6M GPS)
  │  MQTT/WiFi
  ▼
Azure IoT Hub  ──Message Routing──▶ Cosmos DB (locations + zones)
  │                                       ▲       ▲
  │ Event Hub events                      │       │ HTTPS
  ▼                                       │       │
Azure Function: iotToMosquitto            │       │
  │  MQTT publish                         │       │
  ▼                                       │       │
Mosquitto broker (WSS)                    │       │
  │                                       │       │
  ├──▶ Web dashboard (this repo)──────────┘       │
  └──▶ Python anomaly engine ──────────────────────┘
```

The web dashboard subscribes to the Mosquitto broker over WSS for **live telemetry** (proposal-compliant: dashboard talks only via the MQTT broker). It uses REST against Azure Functions for two non-realtime needs: cold-load history and geofence zone CRUD.

## Project layout

- `app/` — Next.js App Router pages.
- `components/` — `MapView`, `StatusBar`, `AlertToast`, `ZoneNameModal`.
- `lib/` — `mqtt.ts`, `api.ts`, `geofence.ts`, `types.ts`.
- `azure-functions/` — copy-paste-ready skeletons:
  - `getZones`, `saveZone`, `deleteZone` — HTTP triggers, Cosmos `zones` container.
  - `iotToMosquitto` — Event Hub trigger that republishes IoT Hub telemetry to Mosquitto.
- `public/alert.wav` — short beep played on geofence breach.

## Run the web app

```bash
cd gps-tracker-web
cp .env.example .env.local      # fill in your values
pnpm install
pnpm dev
```

Open http://localhost:3000.

### Required env vars

See `.env.example`. All four are read at build time (they are `NEXT_PUBLIC_*`).

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE` | Base URL of your Azure Function App, e.g. `https://gps-tracker-api.azurewebsites.net/api`. |
| `NEXT_PUBLIC_MQTT_URL` | Mosquitto WSS endpoint, e.g. `wss://mosquitto.example.com:8083/mqtt`. |
| `NEXT_PUBLIC_MQTT_USER` / `NEXT_PUBLIC_MQTT_PASS` | Read-only Mosquitto user for the dashboard. |
| `NEXT_PUBLIC_MQTT_TOPIC` | Defaults to `gps/+/telemetry`. |

## Azure-side setup (one-time, before web app shows live data)

Spin up Mosquitto and the republisher Function **before** writing/testing web app code, so you're never debugging both at once.

### 1. Mosquitto broker

Pull `eclipse-mosquitto` and run on Azure Container Instances (or a tiny VM). Minimal `mosquitto.conf`:

```conf
listener 1883
listener 8083
protocol websockets

allow_anonymous false
password_file /mosquitto/config/passwd
```

Create users (run inside the container):

```bash
mosquitto_passwd -c /mosquitto/config/passwd dashboard       # for browsers
mosquitto_passwd /mosquitto/config/passwd republisher         # for the Function
```

For production, terminate TLS in front (Azure Front Door / nginx with Let's Encrypt) so the broker is reachable as `wss://...`.

### 2. Cosmos `zones` container

In Azure Portal → Cosmos DB account → `gpsdb` database → **+ Container**:
- Container ID: `zones`
- Partition key: `/id`
- Throughput: minimum (400 RU/s shared is fine).

### 3. Azure Functions

In your existing `gps-tracker-api` Function App, add four functions. Each `azure-functions/<name>/` folder contains an `index.js` and `function.json`. Easiest path: install the Azure Functions Core Tools, then from the `azure-functions/` folder run:

```bash
npm install
func azure functionapp publish gps-tracker-api
```

Application Settings to add:

| Setting | Value |
| --- | --- |
| `COSMOS_CONNECTION_STRING` | (already exists for `getLocations`) |
| `IOTHUB_EVENT_CONNECTION` | IoT Hub → Built-in endpoints → Event Hub-compatible connection string |
| `MOSQUITTO_URL` | `mqtts://<host>:8883` (Function uses TLS, not WSS) |
| `MOSQUITTO_USER` | `republisher` |
| `MOSQUITTO_PASS` | the password from step 1 |

### 4. Verify the MQTT chain in isolation

Before opening the web app, prove messages flow end-to-end with **MQTT Explorer** (free desktop app):

1. Connect to `wss://<mosquitto-host>:8083` as `dashboard`.
2. Subscribe to `gps/#`.
3. Power up the ESP32. Within ~10s you should see JSON payloads arriving on `gps/<deviceId>/telemetry`.

If messages don't arrive, the failure is in IoT Hub → republisher Function → Mosquitto. Fix that before touching the web app.

## Telemetry payload shape

The ESP32 firmware should publish JSON like:

```json
{
  "deviceId": "gps-tracker-1",
  "lat": 31.5204,
  "lng": 74.3587,
  "speed": 12.4,
  "satellites": 8,
  "ts": "2026-05-05T10:15:00Z"
}
```

`ts` is optional — the dashboard fills in `new Date().toISOString()` if missing.

## Geofence zones

- Use the polygon tool in the top-right of the map to draw a zone.
- After closing the polygon, a modal asks for a name and type:
  - **Restricted** — alert when device enters this polygon.
  - **Allowed (non-restricted)** — when at least one allowed zone exists, alert when device leaves all of them.
- Click an existing polygon to delete it (confirms first).
- Zones persist in Cosmos — shared across all dashboards and the Python anomaly engine.

## Verification checklist

1. `pnpm dev` opens at http://localhost:3000; status-bar MQTT dot turns green.
2. Marker moves on the map within ~1s of each ESP32 reading; trail polyline grows.
3. Cold-load shows the last 100 historical points immediately on page reload.
4. Drawing a polygon → modal → save → polygon appears with the right color and persists across reload.
5. Moving into a restricted polygon (or simulating with `mosquitto_pub -t gps/gps-tracker-1/telemetry -m '{"deviceId":"gps-tracker-1","lat":...,"lng":...,"speed":0,"satellites":0}'`): marker turns red, beep plays, status bar shows breach banner.
6. Opening from a second browser shows the same zones and the same live updates.

## Proposal compliance

| Proposal requirement | Implementation |
| --- | --- |
| ESP32 publishes via MQTT to broker | ✅ unchanged (IoT Hub) |
| Broker = HiveMQ or **Mosquitto** | ✅ Mosquitto (named option in proposal) |
| Web dashboard communicates only via MQTT broker for live data | ✅ MQTT.js subscriber to Mosquitto |
| Frontend never talks to ESP32 directly | ✅ all paths via broker / Cosmos |
| Leaflet.js + OpenStreetMap | ✅ |
| MQTT.js (WebSocket client) | ✅ |
| React/Next.js | ✅ Next.js App Router + TypeScript |
| Geofence drawing + restricted/non-restricted zones | ✅ polygon drawing + labels |
| Visual + audible breach alerts | ✅ marker color + toast + banner + beep |

## Out of scope

- ESP32 firmware (group's existing folder).
- Python anomaly engine (separate module; subscribes to same Mosquitto topic, reads zones from Cosmos).
- Authentication on the dashboard itself (course demo: shared MQTT credentials, anonymous Functions).
- Production deployment (Static Web Apps, custom domain, etc.).
