# GPS Tracker — IoT geofencing + AI anomaly detection

```
gps-tracker/
├─ frontend/        Next.js dashboard (live map, geofences, AI Insights panel)
└─ backend/         Python anomaly engine (paho-mqtt + Isolation Forest)
```

## Architecture

```
ESP32 (NEO-6M GPS)
   │  MQTT/WiFi
   ▼
Azure IoT Hub  ──Message Routing──▶ Cosmos DB (locations + zones)
   │                                       ▲       ▲
   │ Event Hub events                      │       │ HTTPS
   ▼                                       │       │
Azure Function: iotToMosquitto             │       │
   │  publishes to gps/<id>/telemetry      │       │
   ▼                                       │       │
Mosquitto broker (WS :8443 / TCP :1883)    │       │
   │                                       │       │
   ├──▶ frontend/  (browser, MQTT.js)──────┘       │  cold-load + zones CRUD via Azure Functions
   │                                               │
   └──▶ backend/   (Python, paho-mqtt) ────────────┘
              │  publishes to gps/<id>/anomaly
              ▼
       frontend re-receives anomaly stream via MQTT
       → AI Insights panel + toast
```

## Quick start

You need **two terminals** running side by side: one for the dashboard, one for the AI engine.

### Terminal 1 — frontend (Next.js dashboard)

```bash
cd frontend
cp .env.example .env.local      # edit if your Azure URLs differ
pnpm install
pnpm dev
```

Open http://localhost:3000.

### Terminal 2 — backend (Python anomaly engine)

```bash
cd backend
uv sync                          # creates .venv, installs paho-mqtt, scikit-learn, numpy
cp .env.example .env             # edit if your Mosquitto host differs
uv run python anomaly_detector.py
```

You'll see colored CLI output. The dashboard's **AI Insights** panel updates within ~1s of each detected anomaly.

## Verifying the full pipeline

1. With both running, open the dashboard: live marker should be moving, MQTT dot green.
2. From a third terminal, simulate a high-speed reading:
   ```bash
   mosquitto_pub -h gps-mqtt-ezza123.southeastasia.azurecontainer.io -p 1883 \
     -t gps/gps-tracker-1/telemetry \
     -m '{"deviceId":"gps-tracker-1","lat":31.5,"lng":74.35,"speed":150,"satellites":10}'
   ```
3. Backend prints a red `ANOMALY abnormal_speed (high)` line.
4. Frontend shows a red toast top-right + new row in the AI Insights panel.

## Per-folder docs

- [`frontend/README.md`](./frontend/README.md) — dashboard architecture, env vars, Azure setup
- [`backend/README.md`](./backend/README.md) — Python engine, tunable parameters, CLI output

## Out of scope (not in this repo)

- ESP32 firmware (group's separate folder, Arduino IDE)
- Mosquitto broker provisioning + IoT Hub→Mosquitto republisher Function (documented in `frontend/README.md`)
- Servo / buzzer / OLED hardware actuator code (device-side)
