import express, { Request, Response } from "express";

import { Message } from "../models/messageModel";
import { config } from "../config";

const router = express.Router();

// Save message
router.post(
  "/create-captcha",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        company,
        message,
        agreeToEmails,
        token,
      } = req.body;

      const url = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
      const formData = new FormData();
      formData.append("secret", config.CAPTCHA_SECRET_KEY);
      formData.append("response", token);

      const result = await fetch(url, {
        body: formData,
        method: "POST",
      });

      const outcome = await result.json();
      if (outcome.success) {
        const newMessage = new Message({
          firstName,
          lastName,
          email,
          phone,
          company,
          message,
          agreeToEmails,
        });

        await newMessage.save();

        // Emit newMessage event to all connected clients
        const io = req.app.get("io");
        io.emit("newMessage", newMessage);

        res.status(200).json("Success");
      } else {
        res.status(400).json("Failed to verify reCAPTCHA");
      }
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Failed to save message", error: error.message });
    }
  }
);

// Patch message
// Make message read by id
router.patch("/read/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    message.read = true;
    await message.save();

    res.status(200).json({ message: "Message marked as read" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Failed to update message", error });
  }
});

// Save message without captcha
router.post("/create", async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      message,
      agreeToEmails,
      token,
    } = req.body;

    const newMessage = new Message({
      firstName,
      lastName,
      email,
      phone,
      company,
      message,
      agreeToEmails,
    });

    await newMessage.save();

    // Emit newMessage event to all connected clients
    const io = req.app.get("io");
    io.emit("newMessage", newMessage);

    res.status(200).json("Success");
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Failed to save message", error: error.message });
  }
});

router.get("/", async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      page = 1,
      limit = 20,
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
    const filter: { [key: string]: any } = {};
    if (firstName) filter.firstName = { $regex: firstName, $options: "i" };
    if (lastName) filter.lastName = { $regex: lastName, $options: "i" };
    if (email) filter.email = { $regex: email, $options: "i" };
    if (phone) filter.phone = { $regex: phone, $options: "i" };
    if (country) filter.country = { $regex: country, $options: "i" };

    // Fetch messages with pagination and filters
    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    // Get total count of messages for pagination
    const totalMessages = await Message.countDocuments(filter);
    const totalPages = Math.ceil(totalMessages / limitNumber);

    res.json({ messages, totalPages });
  } catch (err) {
    res.status(500).json({
      errors: [
        { title: "Server Error", detail: "An unexpected error occurred." },
      ],
    });
  }
});

router.get(
  "/unread-count",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const unreadCount = await Message.countDocuments({ read: false });
      res.status(200).json({ unreadCount });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch unread count", error });
    }
  }
);

// Delete by id
router.delete("/:id", async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const message = await Message.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Emit deleteMessage event to all connected clients
    const io = req.app.get("io");
    io.emit("deleteMessage", message._id);

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete message", error });
  }
});

export default router;