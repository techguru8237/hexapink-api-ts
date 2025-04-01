import express, { Request, Response } from "express";
import { Review } from "../models/reviewModel";

const router = express.Router();

// Create a new review
router.post("/create", async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, company, role, review, rating }: { name: string; company: string; role: string; review: string; rating: number } = req.body;

    const newReview = new Review({
      name,
      company,
      role,
      review,
      rating,
    });

    const savedReview = await newReview.save();
    return res.status(201).json(savedReview);
  } catch (error: any) {
    return res.status(500).json({ message: "Failed to create review", error: error.message });
  }
});

// Get all reviews
router.get("/", async (req: Request, res: Response): Promise<any> => {
  try {
    const reviews = await Review.find();
    return res.status(200).json(reviews);
  } catch (error: any) {
    return res.status(500).json({ message: "Failed to fetch reviews", error: error.message });
  }
});

// Get a review by ID
router.get("/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    return res.status(200).json(review);
  } catch (error: any) {
    return res.status(500).json({ message: "Failed to fetch review", error: error.message });
  }
});

// Update a review by ID
router.put("/update/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, company, role, review, rating }: { name: string; company: string; role: string; review: string; rating: number } = req.body;

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      { name, company, role, review, rating },
      { new: true, runValidators: true }
    );

    if (!updatedReview) {
      return res.status(404).json({ message: "Review not found" });
    }

    return res.status(200).json(updatedReview);
  } catch (error: any) {
    return res.status(500).json({ message: "Failed to update review", error: error.message });
  }
});

// Delete a review by ID
router.delete("/delete/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const deletedReview = await Review.findByIdAndDelete(req.params.id);
    if (!deletedReview) {
      return res.status(404).json({ message: "Review not found" });
    }
    return res.status(200).json({ message: "Review deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: "Failed to delete review", error: error.message });
  }
});

export default router;
