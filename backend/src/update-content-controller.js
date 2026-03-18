import express from "express";
import { update } from "./update-content-service.js";
import { generateChanges } from "./generate-changes-service.js";

const router = express.Router();

router.get("/api/update/:sectionId/:contentId", async (req, res) => {
  const { sectionId, contentId } = req.params;
  const response = await update(sectionId, contentId);

  res.send(response);
});

router.get("/api/changes/:sectionId/:documentId", async (req, res) => {
  const { sectionId, contentId, documentId } = req.params;
  const response = await generateChanges(sectionId, documentId);

  res.send(response);
});

export { router as updateContentRouter };
