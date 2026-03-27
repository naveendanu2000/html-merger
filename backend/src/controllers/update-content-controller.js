import express from "express";
import { update } from "../services/update-content-service.js";
import { generateChanges } from "../services/generate-changes-service.js";
import { searchContent } from "../services/search-content-service.js";

const router = express.Router();

router.get("/api/update/:sectionId/:contentId", async (req, res) => {
  const { sectionId, contentId } = req.params;
  const response = await update(sectionId, contentId);

  res.send(response);
});

router.get("/api/changes/:sectionId/:documentId", async (req, res) => {
  const { sectionId, documentId } = req.params;
  const response = await generateChanges(sectionId, documentId);

  res.send(response);
});

router.get("/api/search/:text", async (req, res) => {
  const { text } = req.params;
  const { score, id } = req.query;

  if (text === undefined) res.status(400).send("Bad Request!");

  if (score && id) {
    const scoreNum = Number(score);
    const idNum = Number(id);

    if (Number.isNaN(scoreNum) || Number.isNaN(idNum)) {
      return res.status(400).send("Bad Request!");
    }
  }

  const response = await searchContent(text, score, id);

  res.send(response);
});

export { router as updateContentRouter };
