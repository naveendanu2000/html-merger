import { getClient } from "../openSearchClient.js";

const indexName = "content";

export async function openSearchContent(queryText, score, id, limit = 10) {
  const client = getClient();

  try {
    const body = {
      size: limit,

      query: {
        bool: {
          should: [
            // FTS equivalent — full word matching
            {
              match: {
                search_text: {
                  query: queryText,
                  boost: 0.7, // same weight as PG fts_score
                },
              },
            },
            // Trigram equivalent — partial/fuzzy matching
            {
              match: {
                search_text: {
                  query: queryText,
                  fuzziness: "AUTO", // handles partial matches
                  boost: 0.3, // same weight as your PG trigram_score
                },
              },
            },
            // Phrase prefix — catches "auth" → "authentication"
            {
              match_phrase_prefix: {
                search_text: {
                  query: queryText,
                  boost: 0.5,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },

      sort: [
        { _score: { order: "desc" } }, // primary sort
        { content_id: { order: "desc" } }, // tie-breaker — must be a mapped keyword/number field
      ],

      // cursor — values must match sort fields exactly
      ...(score !== undefined && id !== undefined
        ? { search_after: [score, id] }
        : {}),
    };

    const response = await client.search({
      index: indexName,
      body,
    });

    const hits = response.body.hits.hits;
    const lastHit = hits[hits.length - 1];

    return {
      data: hits.map((hit) => ({
        id: hit._source.content_id,
        score: hit._score,
        ...hit._source,
      })),

      nextCursor:
        hits.length > 0
          ? {
              score: lastHit.sort[0],
              id: lastHit.sort[1],
            }
          : null,
    };
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}
