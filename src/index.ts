import express from "express";
import { SocketHandler } from "./client.js";
import * as dotenv from "dotenv";
import { asyncWrapper } from "./asyncWrapper.js"; // Adjust the path accordingly
dotenv.config();

let handler: null | SocketHandler = null;

const app = express();

app.use(
  asyncWrapper(async (req, res, next) => {
    if (handler === null) {
      handler = new SocketHandler();
      let status = await handler.Connect_To_Nodes();
    } else if (!handler.selected_node) {
      throw new Error("No nodes available");
    }
    next();
  })
);

app.get(
  "/",
  asyncWrapper(async (req, res) => {
    const ping = await handler?.Check_Ping();
    res.send(ping);
  })
);

app.listen(process.env.PORT, () => {
  console.log(`Server started on port ${process.env.PORT}`);
});
