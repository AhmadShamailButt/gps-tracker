// HTTP trigger: POST /api/saveZone
// Body: { id, name, type, polygon, createdAt }
// Upserts a geofence zone into the Cosmos `zones` container.

const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("gpsdb").container("zones");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors() };
    return;
  }

  const body = req.body;
  if (!body || !body.id || !body.name || !body.type || !Array.isArray(body.polygon)) {
    context.res = { status: 400, headers: cors(), body: { error: "Invalid zone payload" } };
    return;
  }
  if (body.type !== "restricted" && body.type !== "allowed") {
    context.res = { status: 400, headers: cors(), body: { error: "type must be restricted|allowed" } };
    return;
  }

  const doc = {
    id: body.id,
    name: body.name,
    type: body.type,
    polygon: body.polygon,
    createdAt: body.createdAt || new Date().toISOString(),
  };

  const { resource } = await container.items.upsert(doc);

  context.res = {
    headers: { "Content-Type": "application/json", ...cors() },
    body: {
      id: resource.id,
      name: resource.name,
      type: resource.type,
      polygon: resource.polygon,
      createdAt: resource.createdAt,
    },
  };
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
