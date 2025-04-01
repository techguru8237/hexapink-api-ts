import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import sanitize from "mongo-sanitize";
import Stripe from "stripe";

import { config } from "../config";

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

import { User } from "../models/userModel";
import { Transaction } from "../models/transactionModel";

const router = express.Router();

// Apply rate limiting to sensitive routes
const sensitiveRouteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
});

router.get("/me", async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await User.findById(
      { _id: req.body.id },
      { email: 1, _id: 0 }
    );

    res.json({
      title: "Authentication successful",
      detail: "Successfully authenticated user",
      user,
    });
  } catch (err: any) {
    res.status(401).json({
      errors: [
        {
          title: "Unauthorized",
          detail: "Not authorized to access this route",
          errorMessage: err.message,
        },
      ],
    });
  }
});

// Top up wallet (modified)
router.post(
  "/topup",
  sensitiveRouteLimiter,
  async (req: Request, res: Response): Promise<any> => {
    const { userId, amount } = sanitize(req.body); // Sanitize inputs

    try {
      // Retrieve user to ensure they exist
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create a payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // Amount in cents
        currency: "usd", // Change to your desired currency
        payment_method_types: ["card"], // Specify payment method types
      });

      // Respond with the client secret from the payment intent
      res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Top-up error:", error);
      res
        .status(500)
        .json({ message: "Top-up processing error", error: error.message });
    }
  }
);

// Save transaction (new endpoint)
router.post(
  "/save-transaction",
  async (req: Request, res: Response): Promise<any> => {
    const { userId, amount } = req.body;

    try {
      // Retrieve user to ensure they exist
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user's wallet balance
      user.balance += amount;
      await user.save();

      // Save transaction to database
      const transaction = new Transaction({
        userId: user._id,
        amount,
        type: "topup",
        description: "Wallet top-up",
      });
      await transaction.save();

      // Respond with success
      res.status(200).json({ message: "Transaction saved successfully" });
    } catch (error: any) {
      console.error("Save transaction error:", error);
      res
        .status(500)
        .json({ message: "Transaction saving error", error: error.message });
    }
  }
);

// Make a purchase
router.post("/purchase", async (req: Request, res: Response): Promise<any> => {
  const { userId, amount, productId } = req.body;

  try {
    // Retrieve user to ensure they have enough balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Update user's wallet balance
    user.balance -= amount;
    await user.save();

    // Save transaction to database
    const transaction = new Transaction({
      userId: user._id,
      amount,
      type: "purchase",
      description: `Purchase of product ${productId}`,
    });
    await transaction.save();

    // Respond with success
    res.status(200).json({ message: "Purchase successful" });
  } catch (error: any) {
    console.error("Purchase error:", error);
    res
      .status(500)
      .json({ message: "Purchase processing error", error: error.message });
  }
});

router.delete("/me", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, password } = req.body;
    if (typeof password !== "string") {
      throw new Error();
    }

    await User.findByIdAndDelete({ _id: userId });
    res.json({
      title: "Account Deleted",
      detail: "Account with credentials provided has been successfuly deleted",
    });
  } catch (err: any) {
    res.status(401).json({
      errors: [
        {
          title: "Invalid Credentials",
          detail: "Check email and password combination",
          errorMessage: err.message,
        },
      ],
    });
  }
});

router.put("/logout", async (req: Request, res: Response): Promise<any> => {
  try {
    res.json({
      title: "Logout Successful",
      detail: "Successfuly expired login session",
    });
  } catch (err: any) {
    res.status(400).json({
      errors: [
        {
          title: "Logout Failed",
          detail: "Something went wrong during the logout process.",
          errorMessage: err.message,
        },
      ],
    });
  }
});

router.post("/create", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = sanitize(req.body); // Sanitize inputs
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        errors: [
          { title: "Validation Error", detail: "Invalid email format." },
        ],
      });
    }

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        errors: [
          {
            title: "Validation Error",
            detail: "Email and password are required.",
          },
        ],
      });
    }

    // // Check if user already exists
    const existingUser = await User.findOne({ email: req.body.email });

    if (existingUser) {
      return res.status(400).json({
        errors: [
          {
            title: "Registration Error",
            detail: "Email is already registered.",
          },
        ],
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ ...req.body, password: hashedPassword });
    const savedUser = await user.save();

    res.status(201).json({
      title: "User Created",
      detail: "User added successfully!",
      user: savedUser,
    });
  } catch (err: any) {
    res.status(500).json({
      errors: [
        { title: "Server Error", detail: "An unexpected error occurred." },
      ],
    });
  }
});

// Update User
router.put("/update/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.params.id;
    const { password } = req.body;

    // Initialize hashedPassword variable
    let hashedPassword;

    if (password !== "") {
      // Hash the new password
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Prepare the update object
    const updateData = { ...req.body };
    if (hashedPassword) {
      updateData.password = hashedPassword; // Only include hashed password if it exists
    } else {
      const user = await User.findById(userId);
      if (user) {
        updateData.password = user.password;
      } else {
        return res.status(404).json({
          errors: [{ title: "Not Found", detail: "User not found." }],
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true } // Enable validation on update
    );

    if (!updatedUser) {
      return res.status(404).json({
        errors: [{ title: "Not Found", detail: "User not found." }],
      });
    }

    res.json({
      title: "User Updated",
      detail: "User updated successfully!",
      user: updatedUser,
    });
  } catch (err: any) {
    console.error(err); // Log the error for debugging
    res.status(500).json({
      errors: [
        { title: "Server Error", detail: "An unexpected error occurred." },
      ],
    });
  }
});

// Update user's status by user id
router.put(
  "/update-status/:id",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = req.params.id;
      const { status } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        res.status(400).json({ message: "Not fonund user." });
        return;
      }

      user.status = status;
      await user.save();

      res.status(200).json({ message: "Changed user status successfully." });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to change user's status" });
    }
  }
);

// Get All Users with Pagination and Filtering
router.get("/", async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      page = 1,
      limit = 5,
      firstName,
      lastName,
      email,
      phone,
      country,
    } = req.query;

    // Convert page and limit to numbers
    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);

    // Create a filter object based on query parameters
    const filter: Record<string, any> = {};
    if (firstName) filter.firstName = { $regex: firstName, $options: "i" };
    if (lastName) filter.lastName = { $regex: lastName, $options: "i" };
    if (email) filter.email = { $regex: email, $options: "i" };
    if (phone) filter.phone = { $regex: phone, $options: "i" };
    if (country) filter.country = { $regex: country, $options: "i" };

    // Fetch users with pagination and filters
    const users = await User.find(filter)
      .select("-password") // Exclude the password field
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    // Get total count of users for pagination
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limitNumber);

    res.json({ users, totalPages });
  } catch (err: any) {
    res.status(500).json({
      errors: [
        { title: "Server Error", detail: "An unexpected error occurred." },
      ],
    });
  }
});

// Get User by ID
router.get("/one", async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.query.id;
    const user = await User.findById(userId, { password: 0 }); // Exclude password from response

    if (!user) {
      return res.status(404).json({
        errors: [{ title: "Not Found", detail: "User not found." }],
      });
    }

    res.json(user);
  } catch (err: any) {
    res.status(500).json({
      errors: [
        { title: "Server Error", detail: "An unexpected error occurred." },
      ],
    });
  }
});

// Delete User
router.delete(
  "/delete/:id",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = req.params.id;
      const deletedUser = await User.findByIdAndDelete(userId);

      if (!deletedUser) {
        return res.status(404).json({
          errors: [{ title: "Not Found", detail: "User not found." }],
        });
      }

      res.json({
        title: "User Deleted",
        detail: "User deleted successfully!",
      });
    } catch (err: any) {
      res.status(500).json({
        errors: [
          { title: "Server Error", detail: "An unexpected error occurred." },
        ],
      });
    }
  }
);

export default router;
