// IoT Hub event trigger: republishes each device telemetry message
// to the Mosquitto broker as `gps/<deviceId>/telemetry` so the web
// dashboard (and Python AI engine) can subscribe over MQTT.
//
// function.json bindings:
//   - eventHubTrigger from IoT Hub built-in events endpoint
//
// App settings required:
//   - IOTHUB_EVENT_CONNECTION  (Event Hub-compatible connection string)
//   - MOSQUITTO_URL            (e.g. mqtts://mosquitto.example.com:8883)
//   - MOSQUITTO_USER
//   - MOSQUITTO_PASS

const mqtt = require("mqtt");

let client;
function getClient() {
  if (client && client.connected) return client;
  client = mqtt.connect(process.env.MOSQUITTO_URL, {
    username: process.env.MOSQUITTO_USER,
    password: process.env.MOSQUITTO_PASS,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
  });
  return client;
}

module.exports = async function (context, events) {
  const c = getClient();
  await new Promise((resolve) => {
    if (c.connected) return resolve();
    c.once("connect", resolve);
    c.once("error", resolve);
  });

  for (const evt of events) {
    const payload = typeof evt === "string" ? evt : JSON.stringify(evt);
    let deviceId = "unknown";
    try {
      const obj = typeof evt === "string" ? JSON.parse(evt) : evt;
      if (obj && obj.deviceId) deviceId = String(obj.deviceId);
    } catch {
      // keep deviceId fallback
    }
    c.publish(`gps/${deviceId}/telemetry`, payload, { qos: 0 });
  }
};
