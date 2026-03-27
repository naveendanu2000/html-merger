import { pool } from "../pool";

export const searchContent = async (text, score, id) => {
  const hasCursor = score !== undefined && id !== undefined;

  const query = `
    WITH ranked AS (
      SELECT 
        id,
        html_content,
        ts_rank(search_vector, plainto_tsquery($1)) AS fts_score,
        similarity(search_text, $1) AS trigram_score
      FROM your_table
      WHERE
        search_vector @@ plainto_tsquery($1)
        OR search_text % $1
    ),
    scored AS (
      SELECT
        id,
        html_content,
        (0.7 * fts_score + 0.3 * trigram_score) AS score
      FROM ranked
    )
    SELECT *
    FROM scored
    ${
      hasCursor
        ? `
      WHERE
        score < $2
        OR (score = $2 AND id < $3)
    `
        : ""
    }
    ORDER BY score DESC, id DESC
    LIMIT 50;
  `;

  const values = [text];
  if (hasCursor) values.push(score, id);

  const response = await pool.query(query, values);
  return response.rows;
};
