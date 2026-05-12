// HTTP trigger: GET /api/getZones
// Reads all geofence zones from the Cosmos `zones` container.
// Set COSMOS_CONNECTION_STRING in the Function App's Application Settings.

const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("gpsdb").container("zones");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors() };
    return;
  }

  const { resources } = await container.items
    .query("SELECT c.id, c.name, c.type, c.polygon, c.createdAt FROM c")
    .fetchAll();

  context.res = {
    headers: { "Content-Type": "application/json", ...cors() },
    body: resources,
  };
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
