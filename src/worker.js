import crypto from "crypto";
import pkg from './zstd.cjs';
const { decompressBuffer, compressBuffer } = pkg;
import { parentPort, workerData } from "worker_threads";

if (parentPort) {
  const { task, data } = workerData;

  switch (task) {
    case "encrypt":
      const cipherEncrypt = crypto.createCipheriv(
        "chacha20",
        data.key,
        data.nonce
      );
      parentPort.postMessage(
        Buffer.concat([cipherEncrypt.update(data.data), cipherEncrypt.final()])
      );
      break;

    case "decrypt":
      const cipherDecrypt = crypto.createDecipheriv(
        "chacha20",
        data.key,
        data.nonce
      );
      parentPort.postMessage(
        Buffer.concat([cipherDecrypt.update(data.data), cipherDecrypt.final()])
      );
      break;

    case "compress":
      compressBuffer(data, 21, (err, compressedBuffer) => {
        if (err) {
          // Handle the error appropriately
          console.error("Compression error:", err);
          return;
        }
        parentPort.postMessage(compressedBuffer);
      });
      break;

    case "decompress":
      decompressBuffer(data, (err, decompressedBuffer) => {
        if (err) {
          // Handle the error appropriately
          console.error("Decompression error:", err);
          return;
        }
        parentPort.postMessage(decompressedBuffer);
      });
      break;
  }
}
