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
WITH filtered AS (
  SELECT id, data,
         search_vector,
         search_text
  FROM public.content
  WHERE
    search_vector @@ plainto_tsquery('comp')
    OR search_text ILIKE '%comp%'
),
ranked AS (
  SELECT id, data,
         ts_rank(search_vector, plainto_tsquery('comp')) AS fts_score,
         similarity(search_text, 'comp') AS trigram_score
  FROM filtered
)
SELECT id, data,
       (0.7 * fts_score + 0.3 * trigram_score) AS score
FROM ranked
ORDER BY score DESC, id DESC;

-- pagination nexxt 50
-- $2 = last score $1 = search query $3 = last id from prev result
WITH filtered AS (
  SELECT id, data,
         search_vector,
         search_text
  FROM public.content
  WHERE
    search_vector @@ plainto_tsquery('comp')
    OR search_text ILIKE '%comp%'
),
ranked AS (
  SELECT id, data,
         ts_rank(search_vector, plainto_tsquery('comp')) AS fts_score,
         similarity(search_text, 'comp') AS trigram_score
  FROM filtered
)
SELECT id, data,
       (0.7 * fts_score + 0.3 * trigram_score) AS score
WHERE
  (0.7 * fts_score + 0.3 * trigram_score) < $2
  OR (
    (0.7 * fts_score + 0.3 * trigram_score) = $2
    AND id < $3
  )
ORDER BY score DESC, id DESC
LIMIT 50;