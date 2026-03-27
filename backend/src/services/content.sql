ALTER TABLE public.content 
ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
  regexp_replace(html_content, '<[^>]+>', '', 'g')
) STORED,

-- Full-text vector (auto-generated)
ALTER TABLE public.content
ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
  regexp_replace(data, '<[^>]+>', '', 'g')
) STORED;


-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- FTS index
CREATE INDEX idx_fts
ON your_table USING GIN(search_vector);

-- Trigram index
CREATE INDEX idx_trgm
ON your_table USING GIN (search_text gin_trgm_ops);

-- Optional: Tune similarity threshold
SET pg_trgm.similarity_threshold = 0.2;

--search query
-- $1 = search query
WITH ranked AS (
  SELECT id,
         html_content,
         ts_rank(search_vector, to_tsquery($1)) AS fts_score,
         similarity(search_text, $1) AS trigram_score
  FROM your_table
  WHERE
    search_vector @@ to_tsquery($1)
    OR search_text % $1
)
SELECT id,
       html_content,
       (0.7 * fts_score + 0.3 * trigram_score) AS score
FROM ranked
ORDER BY score DESC, id DESC
LIMIT 50;

-- pagination nexxt 50
-- $2 = last score $1 = search query $3 = last id from prev result
WITH ranked AS (
  SELECT id,
         html_content,
         ts_rank(search_vector, to_tsquery($1)) AS fts_score,
         similarity(search_text, $1) AS trigram_score
  FROM your_table
  WHERE
    (search_vector @@ to_tsquery($1)
     OR search_text % $1)
)
SELECT id,
       html_content,
       (0.7 * fts_score + 0.3 * trigram_score) AS score
FROM ranked
WHERE
  (0.7 * fts_score + 0.3 * trigram_score) < $2
  OR (
    (0.7 * fts_score + 0.3 * trigram_score) = $2
    AND id < $3
  )
ORDER BY score DESC, id DESC
LIMIT 50;