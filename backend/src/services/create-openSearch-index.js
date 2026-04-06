import { getClient } from "../openSearchClient.js";

export async function createContentIndex() {
  const indexName = "content";
  const client = getClient();

  try {
    // Check if index already exists
    const exists = await client.indices.exists({ index: indexName });

    if (exists.body) {
      console.log("Index already exists");
      return;
    }

    // Create index with mappings
    const response = await client.indices.create({
      index: indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
        },
        mappings: {
          properties: {
            content_id: {
              type: "long", // bigint → long in OpenSearch
            },
            search_text: {
              type: "text", // full-text search
              analyzer: "standard",
            },
          },
        },
      },
    });

    console.log("Index created:", response.body);
  } catch (err) {
    console.error("Error creating index:", err);
  }
}
