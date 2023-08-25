import { promises as fs } from "fs";
import * as path from "path";
import { Request, Response, NextFunction } from "express";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ErrorWithStatus extends Error {
  status?: number;
}

async function logErrorToFile(err: ErrorWithStatus): Promise<void> {
  try {
    const logsDir = path.join(__dirname, "../logs");
    const errorLogPath = path.join(logsDir, "errors.txt");
    const errorMessage = Buffer.from(
      ` \n | Time: ${new Date()}\n | Error: ${err.message}\n | Stack: ${
        err.stack || ""
      }\n\n`
    );

    if (process.env.DEBUG === "true") {
      console.log("\x1B[31m", `[ERROR]: ${errorMessage.toString()}`);
    }

    await fs.mkdir(logsDir, { recursive: true });
    await fs.appendFile(errorLogPath, errorMessage, "utf-8");
  } catch (error) {
    console.error("\x1B[31m", `[ERROR] Error writing to log file: ${error}`);
  }
}

function asyncWrapper(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      Promise.resolve(fn(req, res, next)).catch((err: ErrorWithStatus) => {
        logErrorToFile(err);
        res.status(err.status || 500).send({ error: err.message });
      });
    } catch (err) {
      logErrorToFile(err as ErrorWithStatus);
      res
        .status((err as ErrorWithStatus).status || 500)
        .send({ error: (err as ErrorWithStatus).message });
    }
  };
}

export { asyncWrapper };
