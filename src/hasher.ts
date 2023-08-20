import crypto from "crypto";
import { Worker } from "worker_threads";

// Nonce Generator with LRU Cache
const nonceCache: Map<string, Buffer> = new Map();

export function nonceGenerator(data: Buffer): Buffer {
  const cachedNonce = nonceCache.get(data.toString("hex"));
  if (cachedNonce) return cachedNonce;

  const dataHash = crypto.createHash("sha256").update(data).digest();
  const nonce = Buffer.alloc(12);

  for (let i = 0; i < 12; i++) {
    nonce[i] = (dataHash[i] + dataHash[i + 12]) & 0xff;
    if (i < 8) {
      nonce[i] = (nonce[i] + dataHash[i + 24]) & 0xff;
    }
  }

  nonceCache.set(data.toString("hex"), nonce);
  return nonce;
}

// Worker function to offload CPU-intensive tasks
export type WorkerTask =
  | { task: "encrypt"; data: { data: Buffer; key: Buffer; nonce: Buffer } }
  | { task: "decrypt"; data: { data: Buffer; key: Buffer; nonce: Buffer } }
  | { task: "compress"; data: Buffer }
  | { task: "decompress"; data: Buffer };

export function runWorker(workerTask: WorkerTask): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./src/worker.js", {
      workerData: workerTask,
    });

    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0)
        reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

// Convert BigUint to number
export function fromBigUint(data: Buffer): number {
  return parseInt(data.slice(1).toString("hex"), 16);
}
