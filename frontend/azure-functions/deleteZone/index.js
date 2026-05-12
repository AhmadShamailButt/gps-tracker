// HTTP trigger: DELETE /api/deleteZone?id=<zoneId>
// Deletes a geofence zone from the Cosmos `zones` container.

const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("gpsdb").container("zones");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors() };
    return;
  }

  const id = req.query.id;
  if (!id) {
    context.res = { status: 400, headers: cors(), body: { error: "id query param required" } };
    return;
  }

  try {
    // partition key matches /id since zones are partitioned by id
    await container.item(id, id).delete();
  } catch (err) {
    if (err.code !== 404) {
      context.res = { status: 500, headers: cors(), body: { error: err.message } };
      return;
    }
  }

  context.res = {
    headers: { "Content-Type": "application/json", ...cors() },
    body: { id },
  };
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
