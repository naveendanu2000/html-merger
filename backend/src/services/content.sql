ALTER TABLE public.content 
ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
  regexp_replace(html_content, '<[^>]+>', '', 'g')
) STORED,

-- Full-text vector (auto-generated)
ALTER TABLE your_table
ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  to_tsvector(
    'english',
    regexp_replace(html_content, '<[^>]+>', '', 'g')
  )
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
      c.search_text %> $1           -- trigram threshold operator (uses GIN index)
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

    ORDER BY score DESC, id DESC
    LIMIT 50;

-- pagination nexxt 50
-- $2 = last score $1 = search query $3 = last id from prev result
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
      c.search_text %> $1           -- trigram threshold operator (uses GIN index)
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
    
        WHERE
        ($2::float IS NULL OR score < $2)           -- cursor: prev_score
        OR ($2::float IS NULL OR (score = $2::float AND id < $3::int))  -- tie-break

    ORDER BY score DESC, id DESC
    LIMIT 50;



  -- trial query
  EXPLAIN (ANALYZE, BUFFERS) WITH filtered AS (
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


-------------------------------- Insertion/Updation Optimizations ---------------------------------

-- Option 1
-- async indexing - add is_indexed column, index the not indexed rows later, FOR UPDATE SKIP locked

-- Option 2
-- Partitioning - partition content table by the created_at(yearly) then indexes will be smaller - faster insertion and updation

-- Option 3
-- Remove heavier index, that is Trigram-GIN index, assuming the user will atleast search for a word or a sentence and not small substring which are not complete words.


-- for insertion optimization (FK contributor(content) --> id(user))
CREATE INDEX idx_content_contributor 
  ON content(contributor);


-- Async indexing - fast insertion/updation response - index later
-- install pg_cron extension (once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- schedule the job every 10 seconds
SELECT cron.schedule('sync-search-index', '10 seconds', $$
  UPDATE content
  SET
    search_text   = regexp_replace(html_content, '<[^>]+>', '', 'g'),
    search_vector = to_tsvector('english', regexp_replace(html_content, '<[^>]+>', '', 'g')),
    indexed       = true
  WHERE indexed = false
  ORDER BY id ASC
  LIMIT 1000;
$$);
```
```
-- Insert happens     → indexed = false
-- 10 seconds later   → pg_cron fires, processes up to 1000 rows
-- Search available   → within 10 seconds of insert
