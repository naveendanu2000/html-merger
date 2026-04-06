import { Client } from "@opensearch-project/opensearch";

let client;

export function getClient() {
  if (!client) {
    client = new Client({
      node: "https://localhost:9200",
      ssl: { rejectUnauthorized: false },
      auth: {
        username: "admin",
        password: process.env.OPENSEARCHADMINPASSWORD?.trim(),
      },
    });
  }
  return client;
}