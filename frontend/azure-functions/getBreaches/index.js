// HTTP trigger: GET /api/getBreaches
// Returns the most recent 200 breach events ordered newest-first.

const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("gpsdb").container("breaches");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors() };
    return;
  }

  const { resources } = await container.items
    .query({
      query: "SELECT TOP 200 * FROM c ORDER BY c.enteredAt DESC",
    })
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
