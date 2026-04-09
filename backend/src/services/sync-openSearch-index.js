import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function syncContent() {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.resolve(__dirname, "../workers/contentWorker.js"),
    );

    worker.on("message", (msg) => {
      console.log("Worker:", msg);
    });

    worker.on("error", reject);

    worker.on("exit", (code) => {
      if (code !== 0) {
        return reject(new Error(`Worker stopped with exit code ${code}`));
      }
      resolve();
    });
  });
}
