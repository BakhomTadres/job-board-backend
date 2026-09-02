import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import userRouter from "../Routes/userRoute.js";
import applicationRoutes from "../Routes/applicationRoute.js";
import jobRouter from "../Routes/jobRoute.js";
import paymentsRouter from "../Routes/payment.routes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

  app.get("/", (req, res) => {
  res.json({
    message: "Job Board API is running"
  });
});

// Routes
app.use("/api/users", userRouter);
app.use("/api", applicationRoutes);
app.use("/api/jobs", jobRouter);
app.use("/api/payments", paymentsRouter);

// مهم جدًا
export default app;