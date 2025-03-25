import express, { Request, Response } from "express";
import multer from "multer";

import { Collection } from "../models/collectionModel";

const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/collections");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

router.post("/one", async (req: Request, res: Response): Promise<any> => {
  try {
    const { type, countries }: { type: string; countries: string[] } = req.body;
    const collections = await Collection.find({ type, status: "Active" });
    const filteredCollections = collections.filter((collection) =>
      (collection.countries ?? []).some((country) =>
        countries.includes(country)
      )
    );
    return res.json(filteredCollections);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post(
  "/create",
  upload.single("file"),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { file } = req;
      const {
        title,
        type,
        description,
        featured,
        countries,
        fee,
        discount,
        columns,
      }: {
        title: string;
        type: string;
        description: string;
        featured: boolean;
        countries: string;
        fee: number;
        discount: number;
        columns: string;
      } = req.body;

      const newCollection = new Collection({
        title,
        image: file ? file.path : null,
        type,
        description,
        countries: JSON.parse(countries),
        fee,
        discount,
        featured,
        columns: JSON.parse(columns),
      });

      const savedCollection = await newCollection.save();
      return res.status(201).json(savedCollection);
    } catch (error: any) {
      console.error("Error creating collection:", error);
      return res
        .status(500)
        .json({ message: "Failed to create collection", error: error.message });
    }
  }
);

router.put(
  "/update/:id",
  upload.single("file"),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { file } = req;
      const {
        title,
        type,
        description,
        featured,
        countries,
        fee,
        discount,
        columns,
      }: {
        title: string;
        type: string;
        description: string;
        featured: boolean;
        countries: string;
        fee: number;
        discount: number;
        columns: string;
      } = req.body;

      let parsedCountries: string[] = [];
      let parsedColumns: any[] = [];
      try {
        parsedCountries = JSON.parse(countries);
        parsedColumns = JSON.parse(columns);
      } catch (parseError) {
        return res
          .status(400)
          .json({ error: "Invalid JSON format in 'countries' or 'columns'" });
      }

      const updateData: any = {
        title,
        type,
        description,
        featured: typeof featured === "string" ? featured === "true" : featured,
        countries: parsedCountries,
        fee,
        discount,
        columns: parsedColumns,
      };

      if (file) {
        updateData.image = file.path;
      }

      const updatedCollection = await Collection.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedCollection) {
        return res.status(404).json({ error: "Collection not found" });
      }

      return res.status(200).json(updatedCollection);
    } catch (error: any) {
      console.error("Error updating collection:", error);
      return res.status(500).json({
        error: "An unexpected error occurred",
        details: error.message,
      });
    }
  }
);

router.put(
  "/update-fields/:id",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const collectionId = req.params.id;
      const updateData = req.body;

      const updatedCollection = await Collection.findByIdAndUpdate(
        collectionId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedCollection) {
        return res.status(404).json({ message: "Collection not found." });
      }

      return res.status(200).json({
        message: "Collection updated successfully.",
        updatedCollection,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: "Failed to update collection.",
        error: error.message,
      });
    }
  }
);

router.get(
  "/featured-collections",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const collections = await Collection.find({ featured: true });
      return res.status(200).json(collections);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

router.get("/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    return res.status(200).json(collection);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "10");

    const collections = await Collection.find()
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Collection.countDocuments();

    return res.status(200).json({
      total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit),
      collections,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete(
  "/delete/:id",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const collection = await Collection.findByIdAndDelete(req.params.id);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      return res.status(200).json({ message: "Collection deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

export default router;
