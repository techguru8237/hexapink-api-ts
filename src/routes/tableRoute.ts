import express, { Request, Response } from "express";
import csv from "csv-parser";
import iconv from "iconv-lite";
import multer, { StorageEngine } from "multer";
import { Parser } from "csv-parse";
import Papa from 'papaparse';
import fs from "fs";
import path from "path";
import { Table } from "../models/tableModel";
import { Tag } from "../models/tagModel";

const router = express.Router();

// Define interfaces for request bodies
interface CreateTableRequest extends Request {
  body: {
    tableName: string;
    delimiter: string;
    tags: string;
  };
  file?: Express.Multer.File;
  user?: { id: string };
}

interface GetTablesRequest extends Request {
  body: {
    tableIds: string[];
  };
}

interface FilteredDataRequest extends Request {
  body: {
    tableId: string;
  };
}

interface UpdateTableRequest extends Request {
  body: {
    tableName: string;
  };
}

interface UpdateTagRequest extends Request {
  body: {
    oldTag: string;
    newTag: string;
  };
}

interface AddTagRequest extends Request {
  body: {
    tag: string;
  };
}

interface DeleteTagRequest extends Request {
  body: {
    tag: string;
  };
}

interface TotalLeadsRequest extends Request {
  body: {
    tableIds: string[];
  };
}

// Configure multer for file uploads
const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/tables");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

router.post(
  "/create",
  upload.single("file"),
  async (req: CreateTableRequest, res: Response): Promise<any> => {
    try {
      const { tableName, delimiter, tags } = req.body;
      const parsedTags = JSON.parse(tags);
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }
      const file = req.file.path;

      const existingTags = await Tag.find();
      const existingTagNames = new Set(existingTags.map((tag) => tag.name));

      // Filter new tags that do not exist in the database
      const newTags = parsedTags.filter(
        (tag: string) => !existingTagNames.has(tag)
      );

      // Save new tags to the database
      const tagPromises = newTags.map((tag: string) =>
        new Tag({ name: tag }).save()
      );
      await Promise.all(tagPromises);

      const results: Array<Record<string, string | undefined>> = [];
      const csvDelimiter =
        delimiter === "comma" ? "," : delimiter === "semicolon" ? ";" : "\t";

      const stream = fs
        .createReadStream(file)
        .pipe(iconv.decodeStream("win1252"))
        .pipe(
          csv({
            separator: csvDelimiter,
            mapHeaders: ({ header }) => header.trim(),
            mapValues: ({ value }) => value.trim(),
          })
        );

      // Preprocess the CSV data to remove trailing commas
      const preprocessLine = (line: string): string => line.replace(/,+$/, "");

      stream.on("data", (data) => {
        const decodedData = Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            typeof value === "string" ? preprocessLine(value) : value,
          ])
        ) as Record<string, string | undefined>;
        results.push(decodedData);
      });

      stream.on("end", async () => {
        if (results.length === 0) {
          return res.status(400).json({ message: "No data found in CSV file" });
        }

        const columns = Object.keys(results[0]); // Save columns list
        const leads = results.length;

        const newTable = new Table({
          userId: req.user?.id || "unknown",
          tableName,
          columns,
          leads,
          tags: parsedTags,
          file,
          delimiter,
        });

        await newTable.save();
        res.status(201).json(newTable);
      });
    } catch (error) {
      console.error("Error creating table:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Get table data by ID
router.post(
  "/tables",
  async (req: GetTablesRequest, res: Response): Promise<any> => {
    try {
      const { tableIds } = req.body;

      const tables = await Table.find({ _id: { $in: tableIds } });

      if (!tables.length) {
        return res.status(404).json({ message: "Tables not found" });
      }

      const results = [];

      for (const table of tables) {
        const { file, delimiter } = table;

        const stripBomStream = (await import("strip-bom-stream")).default;
        const fileStream = fs.createReadStream(file).pipe(stripBomStream());

        const tableData: Array<Record<string, string | undefined>> = [];
        const parser = new Parser({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          delimiter:
            delimiter === "comma"
              ? ","
              : delimiter === "semicolon"
              ? ";"
              : "\t",
        });

        fileStream.pipe(parser);

        try {
          parser.on("readable", function () {
            let record;
            while ((record = parser.read())) {
              tableData.push(record);
            }
          });

          parser.on("error", function (err) {
            throw new Error("Error parsing CSV: " + err.message);
          });

          await new Promise((resolve, reject) => {
            parser.on("end", resolve);
            parser.on("error", reject);
          });

          results.push({ id: table._id, data: tableData });
        } catch (err: any) {
          console.error(err.message);
          return res.status(500).json({ error: err.message });
        }
      }

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

router.get("/all", async (req: Request, res: Response): Promise<any> => {
  try {
    const tables = await Table.find();
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post(
  "/filtered-data",
  async (req: FilteredDataRequest, res: Response): Promise<any> => {
    try {
      const { tableId } = req.body;
      const table = await Table.findById(tableId);

      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }

      // Implement your filtering logic here
      // This is a placeholder, adjust according to your data structure and requirements
      const filteredData: Array<Record<string, string | undefined>> = [];
      res.status(200).json({ data: filteredData });
    } catch (error) {
      console.error("Error fetching filtered data:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

router.post(
  "/file",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { filePath, delimiterKey } = req.body;
      const updatedFilePath = path.resolve(__dirname, "../../", filePath);

      // Determine the delimiter from the query parameters
      const delimiterMap = {
        comma: ",",
        semicolon: ";",
        tab: "\t",
      };

      const delimiter = delimiterMap[delimiterKey as keyof typeof delimiterMap];

      if (!delimiter) {
        return res.status(400).send("Invalid delimiter");
      }

      const fileStream = fs
        .createReadStream(updatedFilePath)
        .pipe(iconv.decodeStream("utf8"));

      const results: Array<Record<string, any>> = [];
      fileStream.on("data", (chunk) => {
        const csvData = chunk.toString();
        Papa.parse(csvData, {
          delimiter,
          header: true,
          complete: (resultsPapa: any) => {
            results.push(...resultsPapa.data);
          },
          error: (error: any) => {
            console.error("Error parsing CSV file:", error);
            if (!res.headersSent) {
              res.status(500).json({ error: "Error parsing CSV file" });
            }
          },
        });
      });

      fileStream.on("end", () => {
        if (!res.headersSent) {
          res.json(results); // Send response only once after parsing is complete
        }
      });
    } catch (error) {
      console.error("Error reading file:", error);
      res.status(500).json({ error: "Error reading file" });
    }
  }
);

// Get tables with pagination
router.get("/", async (req: Request, res: Response): Promise<any> => {
  const {
    page = 1,
    limit = 5,
    minColumns,
    maxColumns,
    minLeads,
    maxLeads,
    startDate,
    endDate,
  } = req.query;

  // Construct filter object
  const filter: Record<string, any> = {};

  if (minColumns || maxColumns) {
    filter["columns.length"] = {};
    if (minColumns)
      filter["columns.length"].$gte = parseInt(minColumns as string);
    if (maxColumns)
      filter["columns.length"].$lte = parseInt(maxColumns as string);
  }

  if (minLeads || maxLeads) {
    filter.leads = {};
    if (minLeads) filter.leads.$gte = parseInt(minLeads as string);
    if (maxLeads) filter.leads.$lte = parseInt(maxLeads as string);
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate as string);
    if (endDate) filter.createdAt.$lte = new Date(endDate as string);
  }

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const tables = await Table.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string));

    const total = await Table.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit as string));

    res.json({
      tables,
      totalPages,
      currentPage: parseInt(page as string),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update a table document by ID
router.put(
  "/update/:id",
  async (req: UpdateTableRequest, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const { tableName } = req.body; // Get the new table name from the request body

      // Validate input
      if (!tableName) {
        return res.status(400).json({ message: "Table name is required" });
      }

      // Find the table by ID and update it
      const updatedTable = await Table.findByIdAndUpdate(
        id,
        { tableName },
        { new: true } // Return the updated document
      );

      if (!updatedTable) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.status(200).json(updatedTable);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Delete a table document by ID
router.delete(
  "/delete/:id",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const table = await Table.findByIdAndDelete(id);

      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.status(200).json({ message: "Table deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Update a tag for a table document by ID
router.put(
  "/updateTag/:id",
  async (req: UpdateTagRequest, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const { oldTag, newTag } = req.body; // Get the old and new tag names from the request body

      // Validate input
      if (!oldTag || !newTag) {
        return res
          .status(400)
          .json({ message: "Both oldTag and newTag are required" });
      }

      // Check for the table existence
      const table = await Table.findById(id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Check if the old tag exists in the table
      if (!table.tags.includes(oldTag)) {
        return res.status(400).json({ message: "Old tag does not exist" });
      }

      // Check for duplication of the new tag
      if (table.tags.includes(newTag)) {
        return res.status(400).json({ message: "Tag name already exists" });
      }

      // Update the tag in the table
      const updatedTable = await Table.findByIdAndUpdate(
        id,
        {
          $set: {
            "tags.$[element]": newTag, // Update the old tag to the new tag
          },
        },
        {
          arrayFilters: [{ element: oldTag }], // Filter for the old tag
          new: true, // Return the updated document
        }
      );

      // Add the new tag to the Tag collection if it doesn't exist
      const existingTag = await Tag.findOne({ name: newTag });
      if (!existingTag) {
        await new Tag({ name: newTag }).save(); // Save the new tag
      }

      res.status(200).json(updatedTable);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Add a tag to a table document by ID
router.post(
  "/addTag/:id",
  async (req: AddTagRequest, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const { tag } = req.body;

      // Validate input
      if (!tag) {
        return res.status(400).json({ message: "Tag is required" });
      }

      // Check for the table existence
      const table = await Table.findById(id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Check for duplication in the table
      if (table.tags.includes(tag)) {
        return res.status(400).json({ message: "Tag already exists" });
      }

      // Add the tag to the table
      const updatedTable = await Table.findByIdAndUpdate(
        id,
        { $addToSet: { tags: tag } }, // Add tag if it doesn't exist
        { new: true }
      );

      // Add the tag to the Tag collection if it doesn't exist
      const existingTag = await Tag.findOne({ name: tag });
      if (!existingTag) {
        await new Tag({ name: tag }).save(); // Save the new tag
      }

      res.status(200).json(updatedTable);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Delete a tag from a table document by ID
router.delete(
  "/deleteTag/:id",
  async (req: DeleteTagRequest, res: Response): Promise<any> => {
    try {
      const { id } = req.params;
      const { tag } = req.body;

      if (!tag) {
        return res.status(400).json({ message: "Tag is required" });
      }

      const updatedTable = await Table.findByIdAndUpdate(
        id,
        { $pull: { tags: tag } }, // Remove the tag
        { new: true }
      );

      if (!updatedTable) {
        return res.status(404).json({ error: "Table not found" });
      }

      res.status(200).json(updatedTable);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Get total rows from given tableIds
router.post(
  "/total-leads",
  async (req: TotalLeadsRequest, res: Response): Promise<any> => {
    try {
      const { tableIds } = req.body;

      const tables = await Table.find({ _id: { $in: tableIds } });

      const totalLeads = tables.reduce((sum, table) => sum + table.leads, 0);

      res.status(200).json({ totalLeads });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default router;
