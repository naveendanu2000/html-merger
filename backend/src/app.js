import { configDotenv } from "dotenv";
configDotenv();

import express from "express";
import cors from "cors";
import { updateContentRouter } from "./controllers/update-content-controller.js";

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);
app.use(updateContentRouter);

app.get("/", (req, res) => {
  res.send("Welcome to HTML-Merger backend!");
});

app.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});
