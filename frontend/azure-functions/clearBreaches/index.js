// HTTP trigger: DELETE /api/clearBreaches
// Deletes every document from the Cosmos `breaches` container.

const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("gpsdb").container("breaches");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors() };
    return;
  }

  const { resources } = await container.items
    .query({ query: "SELECT c.id FROM c" })
    .fetchAll();

  let deleted = 0;
  for (const r of resources) {
    try {
      await container.item(r.id, r.id).delete();
      deleted++;
    } catch (e) {
      context.log.warn(`Failed to delete ${r.id}: ${e.message}`);
    }
  }

  context.res = {
    headers: { "Content-Type": "application/json", ...cors() },
    body: { deleted },
  };
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
