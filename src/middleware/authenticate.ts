import { Request, Response, NextFunction } from "express";

// Extend the Request interface to include the `user` property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
import jwt from "jsonwebtoken";

import { config } from "../config";

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = (req.headers as any).authorization?.split(" ")[1]; // Bearer token

    if (!token) {
      res.status(401).json({
        status: "failed",
        message: "Access denied. No token provided.",
      });
      return; // Ensure the function exits after sending a response
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;

    // Check if the token is nearing expiration (e.g., less than 5 minutes remaining)
    const timeLeft = decoded.exp! * 1000 - Date.now(); // Add non-null assertion for `exp`
    if (timeLeft < 800000) {
      // 5 minutes in milliseconds
      const newToken = jwt.sign(
        { id: decoded.id },
        config.JWT_SECRET,
        { expiresIn: "15m" } // Renew token expiration to 15 minutes
      );
      res.setHeader("x-new-token", newToken); // Send the new token in the response headers
    }

    req.user = decoded as any; // Explicitly cast `decoded` to `any` for `req.user`
    next(); // Call next() to pass control to the next middleware
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        status: "failed",
        errorType: "TOKEN_EXPIRED",
        message: "Token has expired. Please log in again.",
      });
      return; // Ensure the function exits after sending a response
    }

    res.status(401).json({
      status: "failed",
      message: "Invalid token.",
    });
  }
};

export default authMiddleware;
