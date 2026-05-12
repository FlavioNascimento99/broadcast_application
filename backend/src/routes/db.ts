import { Router, Request, Response, NextFunction } from "express";
import prisma from "../db";

const router = Router();

router.get("/ping", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW() AS now`;
    res.json({ ok: true, now: (result as any)[0].now });
  } catch (err) {
    next(err);
  }
});

export default router;
