const saveDiff = (diffResult, contirbutorId, contentId) => {
  // console.log(diffResult);
  diffResult.forEach(async (diff) => {
    let diffQueryResult;
    if (diff.type === "retained") {
      const diffSavingQuery = `UPDATE public.words SET new_index=$1, old_index=$2 WHERE new_index=$2`;

      try {
        diffQueryResult = await pool.query(diffSavingQuery, [
          diff.newIndex,
          diff.oldIndex,
        ]);
      } catch (error) {
        console.log("Retained = ", diff.newIndex, diff.oldIndex);
      }
    }
    if (diff.type === "deleted") {
      const diffSavingQuery = `UPDATE public.words SET is_deleted=true, deleted_by=$1 WHERE new_index=$2 AND word=$3 RETURNING word, deleted_by, content, new_index`;

      // console.log("Deleted = ", contirbutorId, diff.oldIndex, diff.word);
      try {
        diffQueryResult = await pool.query(diffSavingQuery, [
          contirbutorId,
          diff.oldIndex,
          diff.word,
        ]);
        // console.log(diffQueryResult);
      } catch (error) {
        console.log(diff);
        console.log("Deleted = ", contirbutorId, diff.oldIndex, diff.word);
      }

      const getCreatorName = `SELECT public.user.name FROM public.user JOIN public.content ON public.user.id = public.content.contributor where public.content.id=$1`;

      try {
        const creatorName = await pool.query(getCreatorName, [
          diffQueryResult.rows[0].content,
        ]);

        // console.log("diffQueryResult: ", diffQueryResult.rows);
        // console.log("Created By:", creatorName.rows);
        diff.created_by = creatorName.rows[0].name;
      } catch (error) {
        console.error(diff);
        console.error("Deleted = ", contirbutorId, diff.oldIndex, diff.word);
      }
    }
    if (diff.type === "added") {
      const diffSavingQuery = `INSERT INTO public.words(word, new_index, content) VALUES($1, $2, $3)`;

      try {
        diffQueryResult = await pool.query(diffSavingQuery, [
          diff.word,
          diff.newIndex,
          contentId,
        ]);
      } catch (error) {
        console.log(
          "added = ",
          diffResult.word,
          diffResult.newIndex,
          contentId,
        );
      }
    }
  });

  return diffResult;
};