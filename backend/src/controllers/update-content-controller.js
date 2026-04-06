import express from "express";
import { update } from "../services/update-content-service.js";
import { generateChanges } from "../services/generate-changes-service.js";
import { searchContent } from "../services/search-content-service.js";
import { createContentIndex } from "../services/create-openSearch-index.js";
import { syncContent } from "../services/sync-openSearch-index.js";

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

router.get("/create/index/content", async (req, res) => {
  try {
    console.log("OpenSearchAdminPassword", process.env.OPENSEARCHADMINPASSWORD);
    await createContentIndex();
    res.send(
      "Welcome to HTML-Merger backend! open search contentIndex created!",
    );
  } catch (error) {
    console.log("Unable to create Index", error);
  }
});

router.get("/sync", async (req, res) => {
  try {
    const response = await syncContent();
    console.log(response);
  } catch (error) {
    console.log(error);
  }
  res.send("syncing search contentIndex created!");
});

export { router as updateContentRouter };
