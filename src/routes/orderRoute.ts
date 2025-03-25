import express, { Request, Response } from "express";
import multer from "multer";
import { File } from "../models/fileModel";
import { Order } from "../models/orderModel";
import { Transaction } from "../models/transactionModel";
import { User } from "../models/userModel";
import ObjectsToCsv from "objects-to-csv";
import Stripe from "stripe";

import {config} from '../config';
const router = express.Router();
const stripe = new Stripe(config.STRIPE_SECRET_KEY);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/receipts/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

router.post("/create-intent", async (req: Request, res: Response): Promise<any> => {
  try {
    const { volume, prix }: { volume: number; prix: number } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(prix * 100),
      currency: "usd",
      metadata: { volume },
    });

    return res.status(200).send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    return res.status(500).send({ error: "Internal Server Error" });
  }
});

// API to create an order
router.post("/create", upload.array("receipts"), async (req: Request, res: Response): Promise<any> => {
  const { id } = req.user;
  const { files, volume, prix, paid, paymentMethod } = req.body;
  const filesData = JSON.parse(files);
  try {
    if (!req.files) {
      return res.status(400).json({ message: "No files uploaded" });
    }
    const receiptPaths = (req.files as Express.Multer.File[]).map((file) => file.path);

    const order = new Order({
      user: id,
      volume: volume,
      prix,
      paid: paid || "Unpaid",
      paymentMethod,
      receipts: receiptPaths,
    });

    await order.save();

    interface FileData {
      title: string;
      type: string;
      countries: string[];
      collectionId: string;
      image: string;
      unitPrice: number;
      volume: number;
      columns: string;
      data: string;
    }

    const filePromises = filesData.map(async (fileData: FileData) => {
      const data: Record<string, any>[] = JSON.parse(fileData.data);
      const csv = new ObjectsToCsv(data);
      const path: string = `uploads/${fileData.title}.csv`;
      await csv.toDisk(path);

      const file = new File({
        user: id,
        title: fileData.title,
        type: fileData.type,
        countries: fileData.countries,
        collectionId: fileData.collectionId,
        image: fileData.image,
        unitPrice: fileData.unitPrice,
        volume: fileData.volume,
        columns: JSON.parse(fileData.columns),
        status: paid === "Paid" ? "Ready" : "Waiting",
        path,
        orderId: order._id,
      });
      await file.save();
      return file._id;
    });

    const fileIds = await Promise.all(filePromises);

    order.files = fileIds;
    await order.save();

    const transaction = new Transaction({
      userId: id,
      price: prix,
      type: "Order",
      receipts: receiptPaths,
    });
    await transaction.save();

    if (paymentMethod === "Balance") {
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.balance -= prix;
      await user.save();
    }

    return res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: "Error creating order", error });
  }
});

// Pay Router
router.post("/pay", async (req: Request, res: Response): Promise<any> => {
  const { orderId } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.paid = "Paid";
    await order.save();

    return res.status(200).json({
      message: "Order paid successfully",
      order,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: "Error paying order", error });
  }
});

// Get recent 5 Orders
router.get("/recent", async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user.id;
    const { paid } = req.query;
    const filter: Record<string, any> = { user: userId };
    if (paid && paid !== "All") {
      filter.paid = paid;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user");

    return res.status(200).json(orders);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: "Error getting recent orders", error });
  }
});

// Get orders by filter
router.get("/by-user", async (req: Request, res: Response): Promise<any> => {
  const userId = req.user.id;
  const {
    paid,
    minVolume,
    maxVolume,
    minPrix,
    maxPrix,
    minDate,
    maxDate,
    page,
    limit,
  } = req.query;

  const filter: Record<string, any> = { user: userId };
  if (paid) filter.paid = paid;
  if (minVolume) filter.volume = { $gte: Number(minVolume) };
  if (maxVolume) filter.volume = { ...filter.volume, $lte: Number(maxVolume) };
  if (minPrix) filter.prix = { $gte: Number(minPrix) };
  if (maxPrix) filter.prix = { ...filter.prix, $lte: Number(maxPrix) };
  if (minDate && typeof minDate === "string") {
    filter.createdAt = { $gte: new Date(minDate) };
  }
  if (maxDate && typeof maxDate === "string") {
    filter.createdAt = { ...filter.createdAt, $lte: new Date(maxDate) };
  }

  const options = {
    page: parseInt(page as string) || 1,
    limit: parseInt(limit as string) || 10,
    populate: ["files", "user"],
  };

  try {
    const result = await Order.paginate(filter, options);

    return res.status(200).json({
      orders: result.docs,
      totalPages: result.totalPages,
      totalOrders: result.totalDocs,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: "Error getting orders", error });
  }
});

router.get("/", async (req: Request, res: Response): Promise<any> => {
  const {
    paid,
    minVolume,
    maxVolume,
    minPrix,
    maxPrix,
    minDate,
    maxDate,
    page,
    limit,
  } = req.query;

  const filter: Record<string, any> = {};
  if (paid) filter.paid = paid;
  if (minVolume) filter.volume = { $gte: Number(minVolume) };
  if (maxVolume) filter.volume = { ...filter.volume, $lte: Number(maxVolume) };
  if (minPrix) filter.prix = { $gte: Number(minPrix) };
  if (maxPrix) filter.prix = { ...filter.prix, $lte: Number(maxPrix) };
  if (minDate && typeof minDate === "string") {
    filter.createdAt = { $gte: new Date(minDate) };
  }
  if (maxDate && typeof maxDate === "string") {
    filter.createdAt = { ...filter.createdAt, $lte: new Date(maxDate) };
  }

  const options = {
    page: parseInt(page as string) || 1,
    limit: parseInt(limit as string) || 10,
    populate: ["files", "user"],
  };

  try {
    const result = await Order.paginate(filter, options);

    return res.status(200).json({
      orders: result.docs,
      totalPages: result.totalPages,
      totalOrders: result.totalDocs,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: "Error getting orders", error });
  }
});

export default router;
