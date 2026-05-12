// HTTP trigger: POST /api/saveBreach
// Body: BreachEvent { id, zoneId, zoneName, reason, enteredAt, clearedAt, lat, lng }
// Upserts a geofence breach event into the Cosmos `breaches` container.

const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("gpsdb").container("breaches");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors() };
    return;
  }

  const b = req.body;
  if (!b || !b.id || !b.reason || !b.enteredAt) {
    context.res = { status: 400, headers: cors(), body: { error: "Invalid breach payload" } };
    return;
  }

  const doc = {
    id: b.id,
    zoneId: b.zoneId ?? null,
    zoneName: b.zoneName ?? "",
    reason: b.reason,
    enteredAt: b.enteredAt,
    clearedAt: b.clearedAt ?? null,
    lat: typeof b.lat === "number" ? b.lat : 0,
    lng: typeof b.lng === "number" ? b.lng : 0,
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
