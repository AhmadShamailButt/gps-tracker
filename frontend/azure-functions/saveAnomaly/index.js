// HTTP trigger: POST /api/saveAnomaly
// Body: Anomaly { id, deviceId, type, severity, score, reason, lat, lng, ts, detectedAt }
// Upserts an AI anomaly event into the Cosmos `anomalies` container.

const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("gpsdb").container("anomalies");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors() };
    return;
  }

  const a = req.body;
  if (!a || !a.id || !a.type || !a.severity || !a.detectedAt) {
    context.res = { status: 400, headers: cors(), body: { error: "Invalid anomaly payload" } };
    return;
  }

  const doc = {
    id: a.id,
    deviceId: a.deviceId ?? "unknown",
    type: a.type,
    severity: a.severity,
    score: typeof a.score === "number" ? a.score : 0,
    reason: a.reason ?? "",
    lat: typeof a.lat === "number" ? a.lat : 0,
    lng: typeof a.lng === "number" ? a.lng : 0,
    ts: a.ts ?? a.detectedAt,
    detectedAt: a.detectedAt,
  };

  const { resource } = await container.items.upsert(doc);

  context.res = {
    headers: { "Content-Type": "application/json", ...cors() },
    body: resource,
  };
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
