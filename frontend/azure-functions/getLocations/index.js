// HTTP trigger: GET /api/getLocations
// Returns the most recent 100 GPS locations from Cosmos `locations` container.
// Decodes IoT Hub's base64-encoded Body field if present.

const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("gpsdb").container("locations");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors() };
    return;
  }

  const { resources } = await container.items
    .query({
      query: "SELECT TOP 100 * FROM c ORDER BY c._ts DESC",
    })
    .fetchAll();

  const locations = resources
    .map((r) => decodeLocation(r))
    .filter((l) => l !== null);

  context.res = {
    headers: { "Content-Type": "application/json", ...cors() },
    body: locations,
  };
};

function decodeLocation(doc) {
  // ESP32 → IoT Hub messages land with the payload base64'd inside Body.
  if (doc.Body && typeof doc.Body === "string") {
    try {
      const decoded = Buffer.from(doc.Body, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return {
          deviceId: parsed.deviceId ?? doc.deviceId ?? "unknown",
          lat: parsed.lat,
          lng: parsed.lng,
          speed: parsed.speed ?? 0,
          satellites: parsed.satellites ?? 0,
          ts: parsed.ts ?? new Date(doc._ts * 1000).toISOString(),
        };
      }
    } catch {
      // fall through to direct field check
    }
  }
  if (typeof doc.lat === "number" && typeof doc.lng === "number") {
    return {
      deviceId: doc.deviceId ?? "unknown",
      lat: doc.lat,
      lng: doc.lng,
      speed: doc.speed ?? 0,
      satellites: doc.satellites ?? 0,
      ts: doc.ts ?? new Date((doc._ts ?? Date.now() / 1000) * 1000).toISOString(),
    };
  }
  return null;
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
