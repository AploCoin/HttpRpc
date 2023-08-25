import * as chacha20 from "chacha20";
import { init, compress, decompress } from "@bokuweb/zstd-wasm";
import { parentPort, workerData } from "worker_threads";
let inited_state = false;

(async () => {
  if (parentPort) {
    const { task, data } = workerData;

    switch (task) {
      case "encrypt":
        parentPort.postMessage(chacha20.encrypt(data.key, data.nonce, data.data));
        break;

      case "decrypt":
        parentPort.postMessage(chacha20.decrypt(data.key, data.nonce, data.data));
        break;

      case "compress":
      case "decompress":
        if (inited_state === false) {
          await init();
          inited_state = true;
        }

      case "compress":
        const compressed = compress(data, 21);
        parentPort.postMessage(Buffer.from(decompress(compressed)));
        break;

      case "decompress":
        const decompressed = decompress(compressed);
        parentPort.postMessage(Buffer.from(decompress(decompressed)));
        break;
    }
  }
})();
