import * as net from "net";
import * as os from "os";
import * as crypto from "crypto";
import { Worker } from "worker_threads";
import { nonceGenerator, runWorker } from "./hasher.js";
import * as msgpack from "msgpack-lite";
import { sharedKey } from "curve25519-js";

const num_cpus = os.cpus().length;

const executor = new Worker("./src/worker.js", {
  workerData: { maxWorkers: num_cpus * 1024 },
});

export class SocketHandler {
  private socket!: net.Socket;
  private list_nodes: Array<[string, number, boolean, number]> = [
    ["0.0.0.0", 5050, false, 0],
  ];
  private selected_node: [string, number, boolean, number] | null = null;
  private received_data: { [key: number]: any } = {};
  private data_user: any = {};
  public is_listening: boolean = false;

  private async Checker_Exist_Host(): Promise<void> {
    return new Promise((resolve) => {
      for (let i = 0; i < this.list_nodes.length; i++) {
        const start = Date.now();

        // Initialize the socket at the beginning of each iteration
        this.socket = new net.Socket();

        this.socket.on("error", (error: any) => {
          if (error.code === "ECONNREFUSED") {
            console.error(
              `Connection refused to the server: ${error.address}:${error.port}`
            );
            if (this.list_nodes[i][0] === "0.0.0.0") {
              this.list_nodes[i][0] = "localhost";
              this.socket.connect(
                this.list_nodes[i][1],
                this.list_nodes[i][0],
              );
              this.list_nodes[i][2] = true;
            } else {
              this.list_nodes[i][2] = false;
            }
          } else {
            console.error(`Socket error: ${error.message}`);
          }
        });

        this.socket.connect(
          this.list_nodes[i][1],
          this.list_nodes[i][0],
          () => {
            this.list_nodes[i][2] = true;
          }
        );

        this.socket.end();
        this.list_nodes[i][3] = parseFloat(
          ((Date.now() - start) / 1000).toFixed(6)
        );

        if (this.list_nodes[i][2]) {
          if (!this.selected_node) {
            this.selected_node = this.list_nodes[i];
          } else if (this.selected_node[3] > this.list_nodes[i][3]) {
            this.selected_node = this.list_nodes[i];
          }
        }
      }
      resolve();
    });
  }

  public async Connect_To_Nodes(): Promise<boolean> {
    if (!this.selected_node) {
      await this.Checker_Exist_Host();
    }

    if (!this.selected_node || this.selected_node === null) {
      return false;
    }

    this.socket = new net.Socket();
    this.socket.connect(this.selected_node[1], this.selected_node[0]);

    let data = await this.socket.read(32);
    console.log(data)
    // Convert the server's public key to Uint8Array
    const serverPublicKey = Uint8Array.from(data);

    // Generate private key and public key
    const { privateKey: privateKeyObject, publicKey } =
      crypto.generateKeyPairSync("x25519");

    // Convert the private key to Uint8Array
    const privateKey = Uint8Array.from(
      privateKeyObject.export({ type: "pkcs8", format: "der" }).slice(-32)
    );

    // Compute the shared secret using curve25519-js
    const sharedSecret = sharedKey(privateKey, serverPublicKey);
    const nonceKey = nonceGenerator(Buffer.from(sharedSecret));
    const publicKeySys = publicKey
      .export({ type: "pkcs8", format: "der" })
      .slice(-32);
    this.socket.write(publicKeySys);

    this.data_user = {
      socket: {
        connection: this.socket,
        selectedNode: this.selected_node,
      },
      keys: {
        server: {
          publicKey: data,
        },
        client: {
          publicKey: publicKey,
          privateKey: privateKey,
        },
        maintenance: {
          sharedKey: sharedKey,
          nonceKey: nonceKey,
        },
      },
    };

    this.is_listening = true;
    executor.postMessage(this.listen_for_messages);
    return true;
  }

  public Close(): void {
    this.is_listening = false;
  }

  private async listen_for_messages(): Promise<void> {
    if (!this.data_user || !this.data_user.keys) {
      console.error("Data user or keys not initialized");
      return;
    }
    while (this.is_listening) {
      try {
        const dataSize = this.socket.read(4);
        const dataLength = dataSize.readUInt32BE(0);
        const data = this.socket.read(dataLength);

        const decryptedData = await runWorker({
          task: "decrypt",
          data: {
            data: data,
            key: this.data_user.keys.maintenance.sharedKey,
            nonce: this.data_user.keys.maintenance.nonceKey,
          },
        });

        const decompressedData = await runWorker({
          task: "decompress",
          data: decryptedData,
        });

        const unpackedData = msgpack.decode(decompressedData);

        if (unpackedData.Request) {
          // Handle request
        } else {
          const requestId = unpackedData.Response.id;
          this.received_data[requestId] = unpackedData;
        }
      } catch (error) {
        console.error(`Socket error: ${error}`);
        break;
      }
    }

    this.socket.end();
  }

  public async Send_Message(message: any): Promise<number> {
    if (!this.data_user || !this.data_user.keys) {
      await this.Connect_To_Nodes()
    }
    const id_req = Math.floor(Math.random() * 1000000) + 1;

    message.Request.id = id_req;

    if (!this.data_user) {
      throw new Error("No Nodes or not inited");
    }

    const packedMessage = msgpack.encode(message);

    const compressedMessage = await runWorker({
      task: "compress",
      data: packedMessage,
    });

    const encryptedMessage = await runWorker({
      task: "encrypt",
      data: {
        data: compressedMessage,
        key: this.data_user.keys.maintenance.sharedKey,
        nonce: this.data_user.keys.maintenance.nonceKey,
      },
    });

    this.socket.write(Buffer.from(encryptedMessage.length.toString(16), "hex"));
    this.socket.write(encryptedMessage);

    return id_req;
  }

  public Receive_Data(requestId: number, timeout = 20): any {
    const start_time = Date.now();
    while (Date.now() - start_time < timeout * 1000) {
      const data = this.received_data[requestId];
      if (data) {
        delete this.received_data[requestId];
        return data;
      }
    }

    throw new Error(`Timeout waiting for data with ID ${requestId}`);
  }

  public async Check_Ping(): Promise<number> {
    const pingMessage = {
      Request: {
        q: "Ping",
      },
    };

    const start_time = Date.now();
    const id = await this.Send_Message(pingMessage);
    this.Receive_Data(id);
    const elapsed = (Date.now() - start_time) / 1000;
    this.data_user.socket.selectedNode[3] = parseFloat(elapsed.toFixed(6));
    return this.data_user.socket.selectedNode[3];
  }
}

export default SocketHandler;
