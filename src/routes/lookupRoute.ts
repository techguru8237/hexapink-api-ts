import express, { Request, Response } from "express";
import axios from "axios";

import { Lookup } from "../models/lookupModel";

const router = express.Router();

// Create a new lookup
router.post("/create", async (req: Request, res: Response): Promise<any> => {
  try {
    const { country, phone } = req.body;
    const userId = req.user.id;

    // Call external API to validate phone number
    const apiKey = process.env.PHONE_VALIDATION_API_KEY;
    const apiUrl = `https://api.example.com/validate?apiKey=${apiKey}&phone=${phone}&country=${country}`;

    const response = await axios.get(apiUrl);
    const result = response.data.valid ? "Valid" : "Unvalid";

    const lookup = new Lookup({
      user: userId,
      phone,
      country,
      result,
    });

    await lookup.save();

    res.status(201).json(lookup);
  } catch (error) {
    console.error("Error creating lookup:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get lookup records by pagination
router.get("/by-user", async (req: Request, res: Response): Promise<any> => {
  const userId = req.user.id;
  const { page, limit } = req.query;

  const options = {
    page: parseInt(page as string) || 1,
    limit: parseInt(limit as string) || 10,
    sort: { createdAt: -1 },
  };

  try {
    const result = await Lookup.paginate({ user: userId }, options);

    res.status(200).json({
      lookups: result.docs,
      totalPages: result.totalPages,
      totalLookups: result.totalDocs,
    });
  } catch (error) {
    console.error("Error getting lookups:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a lookup by ID
router.delete(
  "/delete/:id",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;

      const lookup = await Lookup.findByIdAndDelete(id);

      if (!lookup) {
        return res.status(404).json({ error: "Lookup not found" });
      }

      res.status(200).json({ message: "Lookup deleted successfully" });
    } catch (error) {
      console.error("Error deleting lookup:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

module.exports = router;
