import { pool } from "../pool.js";

export const searchContent = async (text, score, id) => {
  const hasCursor = score !== undefined && id !== undefined;

  const query = `
    WITH fts_matches AS (
    -- Branch 1: FTS hits (uses GIN index, fast)
    SELECT
      id,
      data,
      search_vector,
      search_text,
      ts_rank_cd(search_vector, query, 32) AS fts_score,  -- 32 = normalize by doc length
      0.0::float AS trigram_score
    FROM public.content, websearch_to_tsquery('english', $1) AS query
    WHERE search_vector @@ query

    UNION ALL

    -- Branch 2: Trigram-only hits NOT already caught by FTS (uses GIN trigram index)
    SELECT
      c.id,
      c.data,
      c.search_vector,
      c.search_text,
      0.0::float AS fts_score,
      word_similarity($1, c.search_text) AS trigram_score
    FROM public.content c
    WHERE
      c.search_text <% $1           -- trigram threshold operator (uses GIN index)
      AND NOT (c.search_vector @@ websearch_to_tsquery('english', $1))
    ),
    deduped AS (
    -- Merge scores for rows that appear in both branches
    SELECT
      id,
      data,
      MAX(fts_score)      AS fts_score,
      MAX(trigram_score)  AS trigram_score
    FROM fts_matches
    GROUP BY id, data
    ),
    scored AS (
    SELECT
      id,
      data,
      fts_score,
      trigram_score,
      (0.7 * fts_score + 0.3 * trigram_score) AS score
    FROM deduped
    )
    SELECT id, data, score
    FROM scored
    ${
      hasCursor
        ? `
        WHERE
        ($2::float IS NULL OR score < $2)           -- cursor: prev_score
        OR ($2::float IS NULL OR (score = $2::float AND id < $3::int))  -- tie-break`
        : ``
    }
    ORDER BY score DESC, id DESC
    LIMIT 50;
  `;

  const values = [text];
  if (hasCursor) values.push(score, id);

  const response = await pool.query(query, values);
  return response.rows;
};
