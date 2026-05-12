"""
GPS anomaly detector — subscribes to Mosquitto over MQTT, runs rule-based
checks plus an Isolation Forest pattern detector, and publishes anomalies
back to the broker so the web dashboard (and anyone else) can react.

Topics:
  - subscribe to:  gps/+/telemetry   (every reading the ESP32 publishes)
  - publish to:    gps/<deviceId>/anomaly   (only when something is flagged)

Run (from the gps-tracker project root):
  cd backend
  uv sync
  cp .env.example .env  # edit with your Mosquitto host
  uv run python anomaly_detector.py
"""

import json
import math
import os
import sys
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone

import numpy as np
import paho.mqtt.client as mqtt
from sklearn.ensemble import IsolationForest


# ─── Load .env (no python-dotenv dependency) ────────────────────────────────
_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_ENV_PATH):
    with open(_ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


# ─── Configuration ───────────────────────────────────────────────────────────
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USER = os.getenv("MQTT_USER", "") or None
MQTT_PASS = os.getenv("MQTT_PASS", "") or None
TELEMETRY_TOPIC = os.getenv("MQTT_TELEMETRY_TOPIC", "gps/+/telemetry")
ANOMALY_TOPIC_FMT = os.getenv("MQTT_ANOMALY_TOPIC_FMT", "gps/{deviceId}/anomaly")

# Rule thresholds (tunable — defend these in your demo)
SPEED_LIMIT_KMH = float(os.getenv("SPEED_LIMIT_KMH", "120"))
STATIONARY_MINUTES = float(os.getenv("STATIONARY_MINUTES", "30"))
JUMP_DISTANCE_KM = float(os.getenv("JUMP_DISTANCE_KM", "1.0"))
JUMP_TIME_SECONDS = float(os.getenv("JUMP_TIME_SECONDS", "10"))

# Isolation Forest parameters
ISOFOREST_N_ESTIMATORS = int(os.getenv("ISOFOREST_N_ESTIMATORS", "100"))
ISOFOREST_CONTAMINATION = float(os.getenv("ISOFOREST_CONTAMINATION", "0.05"))
ISOFOREST_MAX_SAMPLES = int(os.getenv("ISOFOREST_MAX_SAMPLES", "64"))
ISOFOREST_RANDOM_STATE = 42

BUFFER_SIZE = int(os.getenv("BUFFER_SIZE", "200"))
MIN_READINGS_BEFORE_ML = int(os.getenv("MIN_READINGS_BEFORE_ML", "30"))
RETRAIN_EVERY = int(os.getenv("RETRAIN_EVERY", "50"))


# ─── ANSI colors for the CLI ────────────────────────────────────────────────
class C:
    RESET = "\033[0m"
    DIM = "\033[2m"
    BOLD = "\033[1m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    CYAN = "\033[36m"
    MAGENTA = "\033[35m"


# ─── Per-device state ───────────────────────────────────────────────────────
buffers: dict[str, deque[dict]] = defaultdict(lambda: deque(maxlen=BUFFER_SIZE))
models: dict[str, IsolationForest] = {}
readings_since_retrain: dict[str, int] = defaultdict(int)


# ─── Helpers ────────────────────────────────────────────────────────────────
def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def parse_ts(reading: dict) -> float:
    ts = reading.get("ts")
    if ts:
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    return reading.get("_arrived_at", time.time())


def feature_vector(buf: deque[dict]) -> np.ndarray | None:
    """Build [speed, lat_delta, lng_delta, time_delta] for each consecutive pair."""
    if len(buf) < 2:
        return None
    rows = []
    prev = None
    for r in buf:
        if prev is not None:
            dt = max(parse_ts(r) - parse_ts(prev), 0.001)
            rows.append([
                float(r.get("speed", 0)),
                r["lat"] - prev["lat"],
                r["lng"] - prev["lng"],
                dt,
            ])
        prev = r
    if not rows:
        return None
    return np.array(rows, dtype=float)


# ─── Detection ──────────────────────────────────────────────────────────────
def check_rules(buf: deque[dict]) -> dict | None:
    if not buf:
        return None
    latest = buf[-1]
    speed = float(latest.get("speed", 0))

    if speed > SPEED_LIMIT_KMH:
        return {
            "type": "abnormal_speed",
            "severity": "high",
            "score": speed / SPEED_LIMIT_KMH,
            "reason": f"Speed {speed:.1f} km/h exceeds {SPEED_LIMIT_KMH:.0f} km/h threshold",
        }

    if len(buf) >= 2:
        prev = buf[-2]
        dt = parse_ts(latest) - parse_ts(prev)
        d_km = haversine_km(prev["lat"], prev["lng"], latest["lat"], latest["lng"])
        if dt > 0 and dt < JUMP_TIME_SECONDS and d_km > JUMP_DISTANCE_KM:
            return {
                "type": "teleportation",
                "severity": "medium",
                "score": d_km,
                "reason": f"Moved {d_km:.2f} km in {dt:.1f}s — likely sensor glitch",
            }

    cutoff = parse_ts(latest) - STATIONARY_MINUTES * 60
    in_window = [r for r in buf if parse_ts(r) >= cutoff]
    if len(in_window) >= 10 and all(float(r.get("speed", 0)) < 0.5 for r in in_window):
        return {
            "type": "unexpected_stop",
            "severity": "medium",
            "score": float(len(in_window)),
            "reason": f"Device stationary for >= {STATIONARY_MINUTES:.0f} minutes",
        }

    return None


def check_isolation_forest(device_id: str, buf: deque[dict]) -> dict | None:
    if len(buf) < MIN_READINGS_BEFORE_ML:
        return None

    X = feature_vector(buf)
    if X is None or len(X) < MIN_READINGS_BEFORE_ML:
        return None

    model = models.get(device_id)
    needs_train = model is None or readings_since_retrain[device_id] >= RETRAIN_EVERY
    if needs_train:
        model = IsolationForest(
            n_estimators=ISOFOREST_N_ESTIMATORS,
            contamination=ISOFOREST_CONTAMINATION,
            max_samples=min(ISOFOREST_MAX_SAMPLES, len(X)),
            random_state=ISOFOREST_RANDOM_STATE,
        )
        model.fit(X)
        models[device_id] = model
        readings_since_retrain[device_id] = 0
    readings_since_retrain[device_id] += 1

    latest_features = X[-1].reshape(1, -1)
    prediction = int(model.predict(latest_features)[0])  # -1 = anomaly, 1 = normal
    score = float(model.decision_function(latest_features)[0])

    if prediction == -1:
        severity = "high" if score < -0.15 else "medium"
        return {
            "type": "pattern_outlier",
            "severity": severity,
            "score": score,
            "reason": f"Isolation Forest flagged this trajectory (score {score:.3f})",
        }
    return None


# ─── MQTT plumbing ──────────────────────────────────────────────────────────
def publish_anomaly(client: mqtt.Client, device_id: str, latest: dict, finding: dict):
    now_iso = datetime.now(timezone.utc).isoformat()
    payload = {
        "id": f"anom-{uuid.uuid4().hex[:8]}",
        "deviceId": device_id,
        "type": finding["type"],
        "severity": finding["severity"],
        "score": float(finding["score"]),
        "reason": finding["reason"],
        "lat": float(latest["lat"]),
        "lng": float(latest["lng"]),
        "ts": latest.get("ts") or now_iso,
        "detectedAt": now_iso,
    }
    topic = ANOMALY_TOPIC_FMT.format(deviceId=device_id)
    client.publish(topic, json.dumps(payload), qos=0)


def print_status(device_id: str, latest: dict, finding: dict | None):
    ts = datetime.now().strftime("%H:%M:%S")
    speed = float(latest.get("speed", 0))
    lat = latest.get("lat", 0)
    lng = latest.get("lng", 0)
    base = (
        f"{C.DIM}[{ts}]{C.RESET} "
        f"{C.CYAN}{device_id}{C.RESET}  "
        f"{lat:.5f}, {lng:.5f}  "
        f"{C.DIM}speed={speed:.1f}{C.RESET}"
    )
    if finding is None:
        print(f"{base}  {C.GREEN}NORMAL{C.RESET}")
        return
    sev = finding["severity"]
    color = C.RED if sev == "high" else (C.YELLOW if sev == "medium" else C.MAGENTA)
    print(
        f"{base}  {color}{C.BOLD}ANOMALY {finding['type']} ({sev}){C.RESET}  "
        f"{C.DIM}{finding['reason']}{C.RESET}"
    )


def on_connect(client: mqtt.Client, _userdata, _flags, rc, _props=None):
    if rc != 0:
        print(f"{C.RED}MQTT connect failed (rc={rc}){C.RESET}", file=sys.stderr)
        return
    print(
        f"{C.GREEN}Connected{C.RESET} to {MQTT_HOST}:{MQTT_PORT}. "
        f"Subscribing to {C.CYAN}{TELEMETRY_TOPIC}{C.RESET} …"
    )
    client.subscribe(TELEMETRY_TOPIC, qos=0)


def on_message(client: mqtt.Client, _userdata, msg: mqtt.MQTTMessage):
    try:
        reading = json.loads(msg.payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return
    if not isinstance(reading, dict):
        return
    device_id = reading.get("deviceId")
    if not isinstance(device_id, str):
        return
    if not isinstance(reading.get("lat"), (int, float)) or not isinstance(
        reading.get("lng"), (int, float)
    ):
        return

    reading["_arrived_at"] = time.time()
    buf = buffers[device_id]
    buf.append(reading)

    finding = check_rules(buf) or check_isolation_forest(device_id, buf)
    print_status(device_id, reading, finding)

    if finding is not None:
        publish_anomaly(client, device_id, reading, finding)


def main():
    print(f"{C.BOLD}GPS Anomaly Detector{C.RESET}  —  Isolation Forest + rule-based checks")
    print(
        f"{C.DIM}Speed > {SPEED_LIMIT_KMH:.0f} km/h, jump > {JUMP_DISTANCE_KM} km in "
        f"< {JUMP_TIME_SECONDS:.0f}s, stationary > {STATIONARY_MINUTES:.0f} min, "
        f"IsoForest n={ISOFOREST_N_ESTIMATORS}, contamination={ISOFOREST_CONTAMINATION}{C.RESET}"
    )

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print(f"\n{C.DIM}Shutting down…{C.RESET}")
        client.disconnect()


if __name__ == "__main__":
    main()
