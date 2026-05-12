// HTTP trigger: GET /api/getAnomalies
// Returns the most recent 500 AI anomaly events ordered newest-first.

const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const container = client.database("gpsdb").container("anomalies");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors() };
    return;
  }

  const { resources } = await container.items
    .query({
      query: "SELECT TOP 500 * FROM c ORDER BY c.detectedAt DESC",
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
