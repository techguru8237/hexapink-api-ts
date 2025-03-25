import express, { Request, Response } from "express";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import multer, { StorageEngine } from "multer";
import { Transaction } from "../models/transactionModel";
import { User } from "../models/userModel";

import { config } from "../config";

const router = express.Router();
const stripeClient = new Stripe(config.STRIPE_SECRET_KEY || "");

// Define interfaces for request bodies
interface TopupCardRequest extends Request {
  body: {
    userId: string;
    amount: number;
  };
}

interface TopupBankRequest extends Request {
  body: {
    userId: string;
    amount: number;
    paymentId: string;
  };
  files?:
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] };
}

interface ChangeStatusRequest extends Request {
  body: {
    transactionId: string;
  };
}

interface WithdrawRequest extends Request {
  body: {
    userId: string;
    amount: number;
  };
}

interface PurchaseRequest extends Request {
  body: {
    userId: string;
    amount: number;
    productId: string;
  };
}

// Configure your email transport
const transporter = nodemailer.createTransport({
  service: "gmail", // or another email service
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

// Configure multer for receipt uploads
const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/receipts/"); // Save files in the 'uploads/receipts/' directory
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Use a unique filename
  },
});
const upload = multer({ storage });

// GET /api/wallet-transactions
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 5 } = req.query;
    const skip =
      (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .exec();

    const totalTransactions = await Transaction.countDocuments({
      userId,
    }).exec();
    const totalPages = Math.ceil(totalTransactions / (limit as number));

    res.json({
      transactions,
      totalPages,
      totalTransactions,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching wallet transactions" });
  }
});

// Get bank topup requests of all users for the admin page
router.get("/topup-requests", async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 5 } = req.query;
    const skip =
      (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

    const transactions = await Transaction.find({
      paymentmethod: "Bank Transfer",
      type: "Topup",
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .populate("userId")
      .populate("paymentId")
      .exec();

    const totalTransactions = await Transaction.countDocuments({
      paymentmethod: "Bank Transfer",
      type: "Topup",
    }).exec();
    const totalPages = Math.ceil(totalTransactions / (limit as number));

    res.json({
      transactions,
      totalPages,
      totalTransactions,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching wallet transactions" });
  }
});

router.post("/create-payment-intent", async (req: Request, res: Response) => {
  try {
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: 1099,
      currency: "usd",
      payment_method_types: ["card"],
    });

    res.status(200).json({ client_secret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Top-up error:", error);
    res.status(500).json({
      message: "Top-up processing error",
      error: (error as Error).message,
    });
  }
});

// Get recent five topups by userId and status
// If status is all, return all topups
router.get("/topups", async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { status } = req.query;
  const filter: any = { userId: userId, type: "Topup" };
  if (status && status !== "All") {
    filter.status = status;
  }

  try {
    const topups = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(3)
      .exec();

    res.json(topups);
  } catch (error) {
    console.error("Top-ups error:", error);
    res.status(500).json({
      message: "Top-ups processing error",
      error: (error as Error).message,
    });
  }
});

router.post(
  "/topup-card",
  async (req: TopupCardRequest, res: Response): Promise<any> => {
    const { userId, amount } = req.body;

    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.balance += amount;
      await user.save();

      const transaction = new Transaction({
        userId: user._id,
        price: amount,
        type: "Topup",
        status: "Completed",
        paymentmethod: "Credit Card",
        description: "Top-up wallet balance",
      });

      const savedTransaction = await transaction.save();

      res.status(200).json({
        message: "Top-up successful",
        transaction: savedTransaction,
      });
    } catch (error) {
      console.error("Confirm top-up error:", error);
      res.status(500).json({
        message: "Confirm top-up processing error",
        error: (error as Error).message,
      });
    }
  }
);

router.post(
  "/topup-bank",
  upload.array("receipts", 5),
  async (req: TopupBankRequest, res: Response): Promise<any> => {
    const { userId, amount, paymentId } = req.body;

    try {
      const receiptPaths = Array.isArray(req.files)
        ? req.files.map((file) => file.path)
        : [];

      const transaction = new Transaction({
        userId,
        price: amount,
        type: "Topup",
        status: "Waiting",
        paymentmethod: "Bank Transfer",
        paymentId,
        description: "Top-up wallet balance",
        receipts: receiptPaths,
      });

      const savedTransaction = await transaction.save();

      res.status(200).json({
        message: "Top-up request received",
        transaction: savedTransaction,
      });
    } catch (error) {
      console.error("Confirm top-up error:", error);
      res.status(500).json({
        message: "Confirm top-up processing error",
        error: (error as Error).message,
      });
    }
  }
);

// Approve topup request by transactionId
router.post(
  "/chage-status",
  async (req: ChangeStatusRequest, res: Response): Promise<any> => {
    const { transactionId } = req.body;

    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      transaction.status =
        transaction.status === "Completed" ? "Waiting" : "Completed";
      await transaction.save();

      const user = await User.findById(transaction.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (transaction.status === "Completed") {
        user.balance -= transaction.price;
      } else {
        user.balance += transaction.price;
      }
      await user.save();

      // Populate userId and paymentId fields
      const updatedTransaction = await Transaction.findById(transactionId)
        .populate("userId")
        .populate("paymentId");

      // Send email notification to the user
      const mailOptions = {
        from: process.env.EMAIL, // Sender email
        to: user.email, // User's email
        subject: "Top-up Status Changed",
        text: `Dear ${user.firstName} ${
          user.lastName
        },\n\nYour top-up status has been ${
          updatedTransaction && updatedTransaction.status === "Completed"
            ? "approved"
            : "rejected"
        }.\n\nTransaction ID: ${transactionId}\nAmount: ${
          transaction.price
        }\n\nThank you for using our service.\n\nBest regards,\nHexapink Team`,
      };

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error("Error sending email:", err);
        } else {
          console.log("Email sent:", info.response);
        }
      });

      res.status(200).json({
        message: "Top-up request approved",
        transaction: updatedTransaction,
      });
    } catch (error) {
      console.error("Approve top-up error:", error);
      res.status(500).json({
        message: "Approve top-up processing error",
        error: (error as Error).message,
      });
    }
  }
);

// Upload receipts for an existing transaction
router.post(
  "/upload-receipts",
  upload.array("receipts", 5),
  async (req: Request, res: Response): Promise<any> => {
    const { transactionId } = req.body;

    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const receiptPaths: string[] = (
        (req.files as Express.Multer.File[]) ?? []
      ).map((file: Express.Multer.File) => file.path);
      transaction.receipts.push(...receiptPaths);
      await transaction.save();

      res.status(200).json({
        message: "Receipts uploaded successfully",
        transaction,
      });
    } catch (error) {
      console.error("Upload receipts error:", error);
      res.status(500).json({
        message: "Failed to upload receipts",
        error: (error as Error).message,
      });
    }
  }
);

// Example Node.js/Express endpoint
router.post(
  "/withdraw",
  async (req: WithdrawRequest, res: Response): Promise<any> => {
    const { userId, amount } = req.body;

    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      user.balance -= amount;
      await user.save();

      const transaction = new Transaction({
        userId: user._id,
        price: amount,
        type: "Topup",
        status: "Completed",
        paymentmethod: "Credit Card",
      });
      await transaction.save();

      res.status(200).send({ success: true });
    } catch (error) {
      console.error("Withdraw error:", error);
      res.status(500).send({ error: (error as Error).message });
    }
  }
);

// Make a purchase
router.post(
  "/purchase",
  async (req: PurchaseRequest, res: Response): Promise<any> => {
    const { userId, amount, productId } = req.body;
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      user.balance -= amount;
      await user.save();

      const transaction = new Transaction({
        userId: user._id,
        amount,
        type: "purchase",
        description: `Purchase of product ${productId}`,
      });
      await transaction.save();

      res.status(200).json({ message: "Purchase successful" });
    } catch (error) {
      console.error("Purchase error:", error);
      res.status(500).json({
        message: "Purchase processing error",
        error: (error as Error).message,
      });
    }
  }
);

export default router;
