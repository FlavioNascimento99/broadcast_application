import { Router, Request, Response, NextFunction } from "express";
import pool from "../db";

const router = Router();

router.get("/ping", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({ ok: true, now: result.rows[0].now });
  } catch (err) {
    next(err);
  }
});

export default router;
