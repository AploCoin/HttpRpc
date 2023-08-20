import express from "express";
import { SocketHandler } from "./client.js";
import * as dotenv from 'dotenv';
dotenv.config()
let isEnabelNode: boolean = false;
let handler: null | SocketHandler = null;

const app = express();

app.use(async (req, res, next) => {
  if (!isEnabelNode) {
    if (handler?.is_listening === false) {
      return res.json({ error: "No nodes avalible" });
    }
  }
  next();
});

app.get("/", async (req, res) => {
  if (handler && isEnabelNode === true) {
    const ping = await handler.Check_Ping();
    return res.send(ping);
  } else {
    return res.json({ error: "Handler is not initialized" });
  }
});

app.listen(process.env.PORT, async () => {
  handler = new SocketHandler();
});
