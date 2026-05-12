import express, { Express, Request, Response, NextFunction } from "express";
import morgan from "morgan";

import healthRoutes from "./routes/health";
import dbRoutes from "./routes/db";
import topicsRoutes from "./routes/topics";
import postsRoutes from "./routes/posts";

const app: Express = express();

app.use(express.json());
app.use(morgan("dev"));

app.use("/api/health", healthRoutes);
app.use("/api/db", dbRoutes);
app.use("/api/topics", topicsRoutes);
app.use("/api/posts", postsRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
