import { diffArrays } from "diff";
import { pool } from "./pool.js";

function tokenize(data) {
  const tokens = [];
  const regex = /(<[^>]+>|[^<]+)/g;
  let match;

  while ((match = regex.exec(data)) !== null) {
    const raw = match[0].trim();
    if (!raw) continue;

    if (raw.startsWith("<")) {
      tokens.push(raw);
    } else {
      tokens.push(...raw.split(/\s+/).filter(Boolean));
    }
  }

  return tokens;
}

function calculateDiff(currentContentData, suggestedContentData) {
  const currentWords = tokenize(currentContentData);
  const suggestedWords = tokenize(suggestedContentData);

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

function enrichDiffWithFormatting(diffResult) {
  const enriched = [];
  let i = 0;

  while (i < diffResult.length) {
    const token = diffResult[i];
    const isOpeningTag =
      token.word.startsWith("<") && !token.word.startsWith("</");
    const isFormattingTag =
      /^<(b|i|u|strong|em|mark|s|span|del|ins)[\s>]/i.test(token.word);

    if (
      isOpeningTag &&
      isFormattingTag &&
      (token.type === "added" || token.type === "deleted")
    ) {
      const tagName = token.word.match(/^<([a-zA-Z]+)/)[1];
      const closingTag = `</${tagName}>`;
      const wordsBetween = [];
      let j = i + 1;

      while (j < diffResult.length) {
        if (diffResult[j].word === closingTag) break;
        wordsBetween.push(diffResult[j]);
        j++;
      }

      // FIX: closing tag index resolved once, not per-word
      const lastWord = wordsBetween[wordsBetween.length - 1];
      const closingNewIndex = lastWord
        ? lastWord.newIndex != null
          ? lastWord.newIndex + 1
          : lastWord.oldIndex + 1
        : null;

      if (token.type === "added") {
        // FIX: emit opening tag once, then words, then closing tag once
        // First: mark any retained words between as deleted (they're being wrapped anew)
        wordsBetween.forEach((t) => {
          if (t.type === "retained") {
            enriched.push({ ...t, type: "deleted" });
          } else {
            enriched.push(t);
          }
        });

        // Then: emit the full new wrapped sequence once
        enriched.push({ ...token, type: "added" });
        wordsBetween.forEach((t) => {
          // FIX: retained words promoted to added need newIndex from oldIndex
          const newIndex = t.newIndex ?? t.oldIndex ?? null;
          enriched.push({ ...t, type: "added", newIndex });
        });
        enriched.push({
          type: "added",
          word: closingTag,
          newIndex: closingNewIndex,
        });
      } else if (token.type === "deleted") {
        // Emit the full deleted sequence
        enriched.push({ ...token, type: "deleted" });
        wordsBetween.forEach((t) => {
          enriched.push({ ...t, type: "deleted" });
        });
        enriched.push({
          type: "deleted",
          word: closingTag,
          oldIndex: lastWord ? lastWord.oldIndex + 1 : null,
        });

        wordsBetween.forEach((t) => {
          if (t.type === "retained") {
            // FIX: preserve newIndex (same as oldIndex for retained words)
            enriched.push({
              ...t,
              type: "added",
              newIndex: t.newIndex ?? t.oldIndex ?? null,
            });
          } else if (t.type === "added") {
            enriched.push(t);
          }
        });
      }

      i = j + 1;
      continue;
    }

    enriched.push(token);
    i++;
  }

  return enriched;
}

async function saveDiff(
  diffResults,
  contributorId,
  newVersionId,
  sectionId,
  documentId,
) {
  console.log("Saving Data!");

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

  // console.log("Fetched max merge ID: ", maxMergeId.rows[0].max);
  // console.log("currentContentId = ", currentContentId);
  // console.log("contentId = ", contentId);
  // console.log(
  //   "If condition = ",
  //   currentContentId !== contentId && !lastMergeId,
  // );

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
  const diffResult = calculateDiff(currentContentData, suggestedContentData);

  const enrichedDiffResult = enrichDiffWithFormatting(diffResult);
  // console.log(enrichedDiffResult);

  // Saving the updated Content
  const updatedDiffResult = await saveDiff(
    enrichedDiffResult,
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

  // Updating diff summary
  // console.log("Contributor ID: ", contributorId);
  // const changes = await generateChanges(updatedDiffResult, contributorId);

  return { diffResult: updatedDiffResult };
};
