import express from "express";

import { File } from "../models/fileModel";

const router = express.Router();

// API to read files
router.get("/read", async (req, res) => {
  const user = req.user;
  const { page = 1, limit = 10 } = req.query;

  try {
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;

    const files = await File.find({ user: user.id, status: "Ready" })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .sort({ createdAt: -1 });

    res.status(200).json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error reading files", error });
  }
});

// Recent 5 files by user an filter
router.get("/recent", async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

  const filter: { user: any; status?: string } = { user: userId };
  if (status && status !== "All") {
    filter.status = typeof status === "string" ? status : undefined;
  }

  try {
    const files = await File.find(filter).sort({ createdAt: -1 }).limit(3);

    res.status(200).json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error getting recent files", error });
  }
});

// Get count of files and total Volume
router.get("/count", async (req, res) => {
  const userId = req.user.id;

  try {
    const totalFiles = await File.countDocuments({ user: userId }).exec();
    const files = await File.find({ user: userId }).exec();
    const totalVolume = files.reduce((sum, file) => sum + (file.volume ?? 0), 0);

    res.status(200).json({ totalFiles, totalLeads: totalVolume });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error getting file count", error });
  }
});

export default router
