# Backend — Python anomaly engine (Isolation Forest)

Subscribes to the same Mosquitto broker the dashboard uses, runs anomaly detection on every GPS reading, and publishes findings back to the broker on `gps/<deviceId>/anomaly`. The dashboard subscribes to that topic and renders the alerts in the **AI Insights** panel.

## What it detects

**Rule-based (deterministic, run first):**
- `abnormal_speed` — speed exceeds `SPEED_LIMIT_KMH` (default 120)
- `teleportation` — moved >`JUMP_DISTANCE_KM` km in <`JUMP_TIME_SECONDS` seconds (likely sensor glitch)
- `unexpected_stop` — device stationary (speed < 0.5 km/h) for the entire `STATIONARY_MINUTES` window

**Isolation Forest (ML, runs once buffer ≥ 30 readings):**
- `pattern_outlier` — current trajectory features `[speed, lat_delta, lng_delta, time_delta]` flagged as outlier vs the rolling 200-point history
- Severity is derived from the `decision_function` score

## Tunable parameters

All defaults live in `anomaly_detector.py` and are overridable via `.env`. The Isolation Forest knobs you can defend in your demo:

| Parameter | Default | What it does |
| --- | --- | --- |
| `n_estimators` | 100 | Number of trees in the forest. More = stabler, slower. |
| `contamination` | 0.05 | Expected fraction of anomalies. Higher = more sensitive. |
| `max_samples` | 64 | Random subsample size per tree. Smaller = more isolated outliers. |
| `random_state` | 42 | Reproducibility seed. |
| `RETRAIN_EVERY` | 50 | Refit the model after this many new readings. |
| `MIN_READINGS_BEFORE_ML` | 30 | Don't run ML until the buffer has at least this many points. |

## Run

```bash
cd backend
uv sync                          # installs paho-mqtt, scikit-learn, numpy from pyproject.toml
cp .env.example .env             # edit .env — set MQTT_HOST to your Mosquitto container's hostname
uv run python anomaly_detector.py
```

`uv` reads `pyproject.toml` + `uv.lock`, creates a `.venv/`, and resolves deps in seconds. If you don't have `uv`: `brew install uv` (macOS) or see [uv docs](https://docs.astral.sh/uv/).

You'll see colored output like:
```
GPS Anomaly Detector  —  Isolation Forest + rule-based checks
Connected to gps-mqtt-ezza123.southeastasia.azurecontainer.io:1883. Subscribing to gps/+/telemetry …
[14:30:00] gps-tracker-1  31.50878, 74.35016  speed=0.0  NORMAL
[14:30:10] gps-tracker-1  31.50880, 74.35018  speed=2.4  NORMAL
[14:30:20] gps-tracker-1  31.50882, 74.35021  speed=145.0  ANOMALY abnormal_speed (high)  Speed 145.0 km/h exceeds 120 km/h threshold
```

## Force-test an anomaly

Publish a fake reading from another terminal:

```bash
mosquitto_pub -h gps-mqtt-ezza123.southeastasia.azurecontainer.io -p 1883 \
  -t gps/gps-tracker-1/telemetry \
  -m '{"deviceId":"gps-tracker-1","lat":31.5,"lng":74.35,"speed":150,"satellites":10}'
```

The detector prints a red `ANOMALY` line and publishes to `gps/gps-tracker-1/anomaly`. If your dashboard is open, the **AI Insights** panel and toast both react within 1 second.

## Architecture notes

- The detector uses **TCP MQTT (port 1883)**, not WebSocket. Browsers need WSS; Python doesn't.
- It runs **anywhere** that can reach the broker — your laptop, a Raspberry Pi, an Azure VM. Doesn't need Cosmos, doesn't need Azure Functions, doesn't write anywhere except MQTT.
- Multiple devices supported: each `deviceId` gets its own buffer + trained model.
- Stop with `Ctrl+C`. State is in-memory only (intentional — keeps the demo trivial; if you want to persist anomaly history, add a Cosmos write in `publish_anomaly`).
