import express, { Request, Response } from "express";

import {Tag} from "../models/tagModel";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const tags = await Tag.find();
    res.status(200).json(tags);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
