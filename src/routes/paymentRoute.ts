import express, { Request, Response } from "express";
import multer from "multer";
import { Payment } from "../models/paymentModel";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/payments");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Refine type definitions for request body and files
interface BankPaymentRequestBody {
  bankName: string;
  accountOwner: string;
  accountNumber?: string;
  iban?: string;
  rib?: string;
  swift?: string;
  featured: string;
}

interface StripePaymentRequestBody {
  stripePublicKey: string;
  stripeSecretKey: string;
  featured: string;
}

// Get a bank detail by ID
router.get("/bank/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const paymentId = req.params.id;
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found." });
    }

    return res.status(200).json(payment);
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to retrieve payment." });
  }
});

// Create a new bank payment
router.post(
  "/create-bank",
  upload.fields([{ name: "bankLogo" }, { name: "qrCode" }]),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const {
        bankName,
        accountOwner,
        accountNumber,
        iban,
        rib,
        swift,
        featured,
      }: BankPaymentRequestBody = req.body;

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      if (!files || !files["bankLogo"] || !files["qrCode"]) {
        return res.status(400).json({ error: "Bank logo and QR code are required." });
      }

      const bankLogo = files["bankLogo"][0]?.path;
      const qrCode = files["qrCode"][0]?.path;

      if (!bankName || !accountOwner) {
        return res.status(400).json({ error: "Bank Name and Account Owner are required." });
      }

      const payment = new Payment({
        paymentType: "bank",
        bankName,
        accountOwner,
        accountNumber,
        iban,
        rib,
        swift,
        bankLogo,
        qrCode,
        featured: featured === "true",
      });

      await payment.save();

      return res.status(201).json({ message: "Bank payment created successfully.", payment });
    } catch (error: any) {
      return res.status(500).json({ error: "Failed to create bank payment." });
    }
  }
);

// Create a new Stripe payment
router.post("/create-stripe", async (req: Request, res: Response): Promise<any> => {
  try {
    const { stripePublicKey, stripeSecretKey, featured }: StripePaymentRequestBody = req.body;

    if (!stripePublicKey || !stripeSecretKey) {
      return res.status(400).json({ error: "Public Key and Secret Key are required." });
    }

    const payment = new Payment({
      paymentType: "stripe",
      publicKey: stripePublicKey,
      secretKey: stripeSecretKey,
      featured: featured === "true",
    });

    await payment.save();

    return res.status(201).json({ message: "Stripe payment created successfully.", payment });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to create Stripe payment." });
  }
});

// Update a bank payment
router.put(
  "/update-bank/:id",
  upload.fields([{ name: "bankLogo" }, { name: "qrCode" }]),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const paymentId = req.params.id;
      const {
        bankName,
        accountOwner,
        accountNumber,
        iban,
        rib,
        swift,
        featured,
      }: Partial<BankPaymentRequestBody> = req.body;

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "Bank not found." });
      }

      payment.bankName = bankName || payment.bankName;
      payment.accountOwner = accountOwner || payment.accountOwner;
      payment.accountNumber = accountNumber || payment.accountNumber;
      payment.iban = iban || payment.iban;
      payment.rib = rib || payment.rib;
      payment.swift = swift || payment.swift;
      payment.featured = featured === "true";

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      if (files?.["bankLogo"]?.[0]) {
        payment.bankLogo = files["bankLogo"][0].path;
      }
      if (files?.["qrCode"]?.[0]) {
        payment.qrCode = files["qrCode"][0].path;
      }

      await payment.save();

      return res.status(200).json({ message: "Bank payment updated successfully.", payment });
    } catch (error: any) {
      return res.status(500).json({ error: "Failed to update bank payment." });
    }
  }
);

// Update a Stripe payment
router.put("/update-stripe/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const paymentId = req.params.id;
    const { stripePublicKey, stripeSecretKey, featured }: Partial<StripePaymentRequestBody> = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Stripe payment not found." });
    }

    payment.publicKey = stripePublicKey || payment.publicKey;
    payment.secretKey = stripeSecretKey || payment.secretKey;
    payment.featured = featured === "true";

    await payment.save();

    return res.status(200).json({ message: "Stripe payment updated successfully.", payment });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to update Stripe payment." });
  }
});

router.get("/banks", async (req: Request, res: Response): Promise<any> => {
  try {
    const banks = await Payment.find({ paymentType: "bank" });
    return res.status(200).json(banks);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: "Failed to get banks." });
  }
});

// Get all payments with search and pagination
router.get("/", async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = "1", limit = "10", search = "" } = req.query;

    const searchRegex = new RegExp(search as string, "i");

    const payments = await Payment.find({
      $or: [
        { bankName: searchRegex },
        { accountOwner: searchRegex },
        { paymentType: searchRegex },
      ],
    })
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .limit(parseInt(limit as string));

    const totalCount = await Payment.countDocuments({
      $or: [
        { bankName: searchRegex },
        { accountOwner: searchRegex },
        { paymentType: searchRegex },
      ],
    });

    return res.status(200).json({
      payments,
      totalPages: Math.ceil(totalCount / parseInt(limit as string, 10)),
      currentPage: parseInt(page as string, 10),
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to retrieve payments." });
  }
});

router.put("/update-status/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const paymentId = req.params.id;
    const { status } = req.body;

    const user = await Payment.findById(paymentId);
    if (!user) {
      return res.status(400).json({ message: "Not found user." });
    }

    user.status = status;
    await user.save();

    return res.status(200).json({ message: "Changed user status successfully." });
  } catch (error: any) {
    return res.status(500).json({ message: "Failed to change user's status" });
  }
});

// Delete a payment document by ID
router.delete("/delete/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const paymentMethod = await Payment.findByIdAndDelete(id);

    if (!paymentMethod) {
      return res.status(404).json({ error: "Payment not found" });
    }

    return res.status(200).json({ message: "Payment deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
