import { diffArrays } from "diff";
import { pool } from "../pool.js";

function tokenize(data) {
  const tokens = [];
  const formattingTagRegex =
    /^<(b|i|u|strong|em|mark|s|span|del|ins|a)(\s[^>]*)?>$/i;
  const selfClosingRegex = /\/>$/;

  // First pass: raw tokens (tags and words)
  const rawTokens = [];
  const regex = /(<[^>]+>|[^<]+)/g;
  let match;

  while ((match = regex.exec(data)) !== null) {
    const raw = match[0].trim();
    if (!raw) continue;

    if (raw.startsWith("<")) {
      rawTokens.push(raw);
    } else {
      rawTokens.push(...raw.split(/\s+/).filter(Boolean));
    }
  }

  // Second pass: distribute formatting tags onto each word inside them
  let i = 0;
  while (i < rawTokens.length) {
    const token = rawTokens[i];

    const isOpeningFormattingTag =
      token.startsWith("<") &&
      !token.startsWith("</") &&
      !selfClosingRegex.test(token) &&
      formattingTagRegex.test(token);

    if (isOpeningFormattingTag) {
      const tagName = token.match(/^<([a-zA-Z]+)/)[1];
      const closingTag = `</${tagName}>`;

      // Collect all tokens until the closing tag
      let j = i + 1;
      const inner = [];
      while (j < rawTokens.length && rawTokens[j] !== closingTag) {
        inner.push(rawTokens[j]);
        j++;
      }

      // Wrap each inner word with the opening and closing tag
      for (const word of inner) {
        tokens.push(`${token}${word}${closingTag}`);
      }

      i = j + 1; // skip past the closing tag
    } else {
      tokens.push(token);
      i++;
    }
  }

  return tokens;
}

function calculateDiff(currentContentData, suggestedContentData) {
  const currentWords = tokenize(currentContentData);
  const suggestedWords = tokenize(suggestedContentData);

  // const chunks = diffArrays(currentContentData, suggestedContentData);
  const chunks = diffArrays(currentWords, suggestedWords);

  const ops = [];
  let oldIdx = 0;
  let newIdx = 0;

  for (const chunk of chunks) {
    for (const word of chunk.value) {
      if (!chunk.added && !chunk.removed) {
        ops.push({
          type: "retained",
          word,
          oldIndex: oldIdx,
          newIndex: newIdx,
        });
        oldIdx++;
        newIdx++;
      } else if (chunk.removed) {
        ops.push({ type: "deleted", word, oldIndex: oldIdx });
        oldIdx++;
      } else if (chunk.added) {
        ops.push({ type: "added", word, newIndex: newIdx });
        newIdx++;
      }
    }
  }

  return ops;
}

async function saveDiff(
  diffResults,
  contributorId,
  newVersionId,
  sectionId,
  documentId,
) {
  console.log("Saving Data!");
  console.log(diffResults);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const maxMergeId = await client.query(
      `SELECT max(merge_id) from public.words WHERE section = $1 AND document = $2`,
      [sectionId, documentId],
    );

    const prevRes = await client.query(
      `SELECT word, new_index, content
       FROM public.words
       WHERE merge_id = (
         SELECT MAX(merge_id)
         FROM public.words
         WHERE section = $1 AND document = $2
       )`,
      [sectionId, documentId],
    );

    const prevIndexMap = new Map();
    for (const row of prevRes.rows) {
      prevIndexMap.set(Number(row.new_index), row);
    }

    const values = [];
    const placeholders = [];
    let i = 1;
    const nextMergeId = (Number(maxMergeId.rows[0].max) || 0) + 1;

    for (const word of diffResults) {
      if (word.word === "null" || !word.word) continue;

      let contentId = null;
      let newIndex = word.newIndex ?? null;
      let oldIndex = word.oldIndex ?? null;
      let deletedBy = null;

      if (word.type === "added") {
        contentId = newVersionId;
        oldIndex = null;
      } else if (word.type === "retained") {
        const prev =
          oldIndex != null ? prevIndexMap.get(Number(oldIndex)) : undefined;
        contentId = prev?.content ?? newVersionId;
      } else if (word.type === "deleted") {
        const prev =
          oldIndex != null ? prevIndexMap.get(Number(oldIndex)) : undefined;
        contentId = prev?.content ?? newVersionId;
        newIndex = oldIndex;
        deletedBy = contributorId;
      }

      values.push(
        word.word,
        newIndex,
        contentId,
        word.type,
        oldIndex,
        deletedBy,
        sectionId,
        documentId,
        nextMergeId,
      );
      placeholders.push(
        `($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`,
      );
    }

    if (placeholders.length === 0) {
      console.log("No words to insert, skipping save.");
      await client.query("COMMIT");
      return [];
    }

    const query = `
      INSERT INTO public.words
        (word, new_index, content, update_type, old_index, deleted_by, section, document, merge_id)
      VALUES ${placeholders.join(",")}
      RETURNING word, update_type, deleted_by, merge_id
    `;

    const result = await client.query(query, values);
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`Unable to save data: ${error.message}`);
  } finally {
    client.release();
  }
}

export const update = async (sectionId, contentId) => {
  // Getting current content id from the section
  const currentContentIdQuery =
    "SELECT content FROM public.section WHERE id=$1";

  const currentContentIdResult = await pool.query(currentContentIdQuery, [
    sectionId,
  ]);

  const currentContentId = currentContentIdResult.rows[0].content;

  const maxMergeId = await pool.query(
    `SELECT max(merge_id) from public.words WHERE section = $1 AND document = $2`,
    [sectionId, 1],
  );

  const lastMergeId = maxMergeId.rows[0].max;

  if (currentContentId !== contentId && !lastMergeId) {
    console.log("No Merge found, Saving words data!");
    update(sectionId, currentContentId);
  }

  // Getting currentContentData
  const currentContentDataQuery = "SELECT data from public.content where id=$1";

  const currentContentDataResult = await pool.query(currentContentDataQuery, [
    currentContentId,
  ]);

  const currentContentData = currentContentDataResult.rows[0].data;

  // Getting suggestedContentData
  const suggestedContentDataQuery =
    "SELECT data, contributor from public.content where id=$1";

  const suggestedContentDataResult = await pool.query(
    suggestedContentDataQuery,
    [contentId],
  );
  const suggestedContentData = suggestedContentDataResult.rows[0].data;

  const contributorId = suggestedContentDataResult.rows[0].contributor;

  // Calculate Diff between current content and suggested content
  const diffResult = calculateDiff(
    currentContentData,
    suggestedContentData,
  ).filter((word) => word.word !== "null" || !word.word);
  // console.log("Diff Results: ", diffResult);

  const updatedDiffResult = await saveDiff(
    diffResult,
    contributorId,
    contentId,
    1,
    1,
  );
  // console.log(updatedDiffResult);

  // Update the current content in section
  const updateContent =
    "UPDATE public.section SET content=$1 WHERE id=$2 returning *";

  const updated_result = await pool.query(updateContent, [
    contentId,
    sectionId,
  ]);

  console.log(updated_result.rows[0]);

  return { diffResult: updatedDiffResult };
};
