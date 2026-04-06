import { Worker } from "worker_threads";
import path from "path";

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
