import { parentPort } from "worker_threads";
import { Client as PGClient } from "pg";
import { getClient } from "../openSearchClient.js";

const osClient = getClient();

const pgClient = new PGClient({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
});

async function run() {
  await pgClient.connect();

  const batchSize = 1000;

  while (true) {
    // 1. Fetch unsynced rows
    const res = await pgClient.query(
      `
      SELECT id, search_text
      FROM public.content
      WHERE is_synced = false
      LIMIT $1
    `,
      [batchSize],
    );

    if (res.rows.length === 0) {
      parentPort.postMessage("No more data to sync");
      break;
    }

    // 2. Prepare bulk payload
    const body = [];

    for (const row of res.rows) {
      body.push({
        index: {
          _index: "content",
          _id: row.id,
        },
      });

      body.push({
        content_id: row.id,
        search_text: row.search_text,
      });
    }

    // 3. Bulk insert into OpenSearch
    const bulkResponse = await osClient.bulk({ body });

    if (bulkResponse.body.errors) {
      console.error("Bulk insert errors:", bulkResponse.body);
    }

    // 4. Mark as synced
    const ids = res.rows.map((r) => r.id);

    await pgClient.query(
      `
      UPDATE public.content
      SET is_synced = true
      WHERE id = ANY($1)
    `,
      [ids],
    );

    parentPort.postMessage(`Synced batch of ${res.rows.length}`);
  }

  await pgClient.end();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
