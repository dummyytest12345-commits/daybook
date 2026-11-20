import http from "node:http";
import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { attachSockets } from "./sockets/index.js";

const app = createApp();

if (process.env.VERCEL) {
  await connectDb();
} else {
  async function main() {
    await connectDb();
    console.log("MongoDB Atlas connected");
    const server = http.createServer(app);
    const io = attachSockets(server);

    server.listen(env.port, () =>
      console.log(
        `Daybook API listening on http://localhost:${env.port} (${env.nodeEnv})`,
      ),
    );

    const shutdown = async (signal) => {
      console.log(`${signal} received, shutting down`);
      io.close();
      server.close(async () => {
        await disconnectDb();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 8000).unref();
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }

  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export default app;
