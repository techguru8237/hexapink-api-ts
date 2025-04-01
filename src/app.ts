import express, { Request, Response, NextFunction } from "express";
import http from "http";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import { Server } from "socket.io";

require("dotenv").config();

import authRoute from "./routes/authRoute";
import usersRoute from "./routes/userRoute";
import tableRoute from "./routes/tableRoute";
import paymentRoute from "./routes/paymentRoute";
import collectionRoute from "./routes/collectionRoute";
import tagRoute from "./routes/tagRoute";
import orderRoute from "./routes/orderRoute";
import fileRoute from "./routes/fileRoute";
import transactionRoute from "./routes/transactionRoute";
import reviewRoute from "./routes/reviewRoute";
import messageRoute from "./routes/messageRoute";

import authMiddleware from "./middleware/authenticate";

mongoose.Promise = global.Promise;

const dbUri = process.env.DB_URI;
const port = process.env.PORT || 5000;

if (!dbUri) {
  throw new Error("DB_URI is not defined in the environment variables");
}

mongoose.connect(dbUri).then(
  () => {
    console.log("🏅 Connected to mongoDB 💨");
  },
  (err) => console.log("Error connecting to mongoDB", err)
);

mongoose.set("debug", true);

const app = express();

app.use(helmet()); // Add security headers
app.use(bodyParser.json({ limit: "10mb" })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Expose-Headers", "x-new-token");
  next();
});

app.use(
  cors({
    origin: process.env.FRONT_URL,
    methods: ["GET", "PATCH", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoute);
app.use("/api/users", authMiddleware, usersRoute);
app.use("/api/table", authMiddleware, tableRoute);
app.use("/api/collection", authMiddleware, collectionRoute);
app.use("/api/payment", authMiddleware, paymentRoute);
app.use("/api/tag", authMiddleware, tagRoute);
app.use("/api/order", authMiddleware, orderRoute);
app.use("/api/file", authMiddleware, fileRoute);
app.use("/api/transaction", authMiddleware, transactionRoute);
app.use("/api/reviews", authMiddleware, reviewRoute);
app.use("/api/message", messageRoute);
app.use("/api/landing", collectionRoute);

// Health check route
app.get("/api/health", (req, res) => {
  console.log("Server is running correctly!");
});

// Create HTTP server and integrate socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONT_URL, // Allow only this origin
    methods: ["GET", "POST"],
  },
});

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// Attach io instance to app for use in routes
app.set("io", io);

// Replace app.listen with server.listen
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port} 💨 `);
});

module.exports = { app, io };
