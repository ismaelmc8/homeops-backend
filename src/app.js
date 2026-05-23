import express from "express";
import cors from "cors";
import apiRoutes from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { getCorsOrigin } from "./config/env.js";

export function createApp() {
  const app = express();
  const corsOrigin = getCorsOrigin();

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  app.use("/api", apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
