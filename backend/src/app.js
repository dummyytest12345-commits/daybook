import fs from "node:fs";
import path from "node:path";
// ... keep your other imports

export function createApp() {
  const app = express();
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(distPath);

  if (hasDist) {
    app.use(express.static(distPath, { index: false }));
  }

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());

  app.use(
    cors({
      origin: false,
      credentials: false,
      allowedHeaders: ["Content-Type", "Authorization", "x-socket-id"],
      exposedHeaders: ["Retry-After"],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev"));

  app.get("/health", (_req, res) =>
    res.json({
      status: "ok",
      db: dbReady() ? "up" : "down",
      time: new Date().toISOString(),
    }),
  );
  app.use("/api", routes);

  if (hasDist) {
    app.use(/.*/, (_req, res) =>
      res.sendFile(path.join(distPath, "index.html")),
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
