import express, { Router, Request, Response } from "express";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import juice from "juice";
import path from "path";
import fs from "fs";

import { config } from "../config";
import { User } from "../models/userModel";

const router: Router = express.Router();
const transporter = nodemailer.createTransport({
  service: "gmail", // or another email service
  auth: {
    user: config.EMAIL,
    pass: config.PASSWORD,
  },
});

router.post("/signup", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    // Validate password type
    if (typeof password !== "string") {
      return res.status(400).json({ message: "Password must be a string." });
    }

    // Check if the user already exists
    const existUser = await User.findOne({ email: email });

    if (existUser && existUser.is_verified) {
      return res.status(400).json({
        errorType: "USER_ALREADY_REGISTERED",
        message: "You have already registered. Please log in.",
      });
    } else if (existUser) {
      return res.status(400).json({
        errorType: "USER_ALREADY_EXISTS",
        message: "User already exists. Please verify your email.",
      });
    }

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const otpExpiration = Date.now() + 600000;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = new User({
      ...req.body,
      password: hashedPassword,
      otp: verificationCode,
      otp_expiration: otpExpiration,
    });
    await user.save();

    // Read the HTML template
    const templatePath = path.join(__dirname, "../templates/otp-email.html");
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    htmlTemplate = htmlTemplate.replace(/OTP_CODE/g, verificationCode);

    const inlinedHtml = juice(htmlTemplate);

    // Send email with the reset link
    await transporter.sendMail({
      from: config.EMAIL,
      to: email,
      subject: "Verify Email",
      html: inlinedHtml,
      attachments: [
        {
          filename: "logo.png",
          path: path.join(__dirname, "../assets/logo.png"),
          cid: "logo-image", //same cid value as in the html img src
        },
      ],
    });

    res.status(201).json({
      message:
        "You have successfully registered in Hexapink. Please check your email.",
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        errorType: "USER_NOT_FOUND",
        message: "User with the provided email does not exist.",
      });
    }

    if (user.status === "Suspended") {
      return res.status(400).json({
        errorType: "USER_SUSPENDED",
        message: "Your account has been suspended.",
      });
    }

    // Compare the password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        errorType: "INVALID_PASSWORD",
        message: "Invalid password.",
      });
    }

    if (!user.is_verified) {
      return res.status(400).json({
        errorType: "ACCOUNT_NOT_VERIFIED",
        message: "Account not verified. Please verify your account.",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
      },
      config.JWT_SECRET || "default_secret",
      { expiresIn: "15m" } // Increase token expiration to 15 minutes
    );

    // Successful login
    res.status(200).json({
      message: "Logged in Successfully",
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        status: user.status,
        balance: user.balance,
        token: token,
      },
    });
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.status(500).json({
      errorType: "SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
  }
});

router.post(
  "verifyEmail",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { email, otp } = req.body;
      // Check if user exists
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).json({
          message: "Invalid email or OTP.",
          errorType: "INVALID_EMAIL_OR_OTP",
        });
      }

      // Check if OTP is correct and not expired
      if (
        user.otp !== otp ||
        (user.otp_expiration && user.otp_expiration.getTime() < Date.now())
      ) {
        return res.status(400).json({
          message: "Invalid or expired OTP.",
          errorType: "INVALID_OR_EXPIRED_OTP",
        });
      }

      // Update user's verification status
      user.is_verified = true;
      user.otp = undefined;
      user.otp_expiration = undefined;
      await user.save();

      // Read the HTML template
      const templatePath = path.join(
        __dirname,
        "../templates/welcome-email.html"
      );
      let htmlTemplate = fs.readFileSync(templatePath, "utf8");
      htmlTemplate = htmlTemplate.replace("FRONTEND_URL", config.FRONT_URL);

      const inlinedHtml = juice(htmlTemplate);

      // Send email with the reset link
      await transporter.sendMail({
        from: config.EMAIL,
        to: email,
        subject: "Welcome to HexaPink",
        html: inlinedHtml,
        attachments: [
          {
            filename: "logo.png",
            path: path.join(__dirname, "../assets/logo.png"),
            cid: "logo-image", //same cid value as in the html img src
          },
        ],
      });

      res.status(200).json({ message: "Email verified successfully." });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to verify email." });
    }
  }
);

router.post("/resendOtp", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid email.",
        errorType: "INVALID_EMAIL",
      });
    }

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const otpExpiration = new Date(Date.now() + 600000);

    user.otp = verificationCode;
    user.otp_expiration = otpExpiration;
    await user.save();

    // Read the HTML template
    const templatePath = path.join(__dirname, "../templates/otp-email.html");
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");
    htmlTemplate = htmlTemplate.replace(/OTP_CODE/g, verificationCode);

    const inlinedHtml = juice(htmlTemplate);

    await transporter.sendMail({
      from: config.EMAIL,
      to: email,
      subject: "Email Verification Code",
      html: inlinedHtml,
      attachments: [
        {
          filename: "logo.png",
          path: path.join(__dirname, "../assets/logo.png"),
          cid: "logo-image",
        },
      ],
    });

    res.status(200).json({
      message: "Sent verification code again. Please check your email.",
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post(
  "/forgotPassword",
  async (req: Request, res: Response): Promise<any> => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).send({ message: "User not found" });
    // Generate a password reset token
    const token = crypto.randomBytes(20).toString("hex");

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    // Read the HTML template
    const templatePath = path.join(
      __dirname,
      "../templates/reset-password.html"
    );
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    // Replace the placeholder with the actual reset password link
    const resetUrl = `${config.FRONT_URL}/reset-password/${token}`;
    htmlTemplate = htmlTemplate.replace(/RESET_PASSWORD_LINK/g, resetUrl);

    const inlinedHtml = juice(htmlTemplate);

    // Send email with the reset link
    await transporter.sendMail({
      from: config.EMAIL,
      to: email,
      subject: "Password Reset",
      html: inlinedHtml,
      attachments: [
        {
          filename: "logo.png",
          path: path.join(__dirname, "../assets/logo.png"),
          cid: "logo-image", //same cid value as in the html img src
        },
      ],
    });

    res.status(200).json({ message: "Password reset link sent to your email" });
  }
);

router.post(
  "/resetPassword",
  async (req: Request, res: Response): Promise<any> => {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).send({ message: "Invalid or expired token" });

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).send({ message: "Password has been reset" });
  }
);

export default router;