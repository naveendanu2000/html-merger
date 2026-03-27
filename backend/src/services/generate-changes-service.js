import { pool } from "../pool.js";

export const generateChanges = async (sectionId, documentId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lastMergeId = await client.query(
      `SELECT max(merge_id) from public.words WHERE section = $1 AND document = $2`,
      [sectionId, documentId],
    );
    const mergeId = lastMergeId.rows[0].max;

    const latestTrack = await client.query(
      `SELECT 
      w.update_type,
      w.word,
      w.old_index,
      w.new_index,
      w.content,
      u.name AS created_by,
      d.name AS deleted_by
        FROM public.words w
        JOIN public.content c ON w.content = c.id
        JOIN public.user u ON c.contributor = u.id
        LEFT JOIN public.user d ON w.deleted_by = d.id
        WHERE w.section = $1
        AND w.document = $2
        AND w.merge_id = $3`,
      [sectionId, documentId, mergeId],
    );

    const diffResult = latestTrack.rows;
    // console.log(diffResult);
    return diffResult;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Diff save failed:", err);
    throw err;
  } finally {
    client.release();
  }
};
