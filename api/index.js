import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import userRouter from "../Routes/userRoute.js";
import applicationRoutes from "../Routes/applicationRoute.js";
import jobRouter from "../Routes/jobRoute.js";
import connectDB from "../Data/db.js";
import paymentsRouter from "../Routes/payment.routes.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: ["https://career-hub-website.vercel.app","http://localhost:4200"],
  }),
);

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Job Board API is running",
  });
});

// Routes
app.use("/api/users", userRouter);
app.use("/api", applicationRoutes);
app.use("/api/jobs", jobRouter);
app.use("/api/payments", paymentsRouter);

// مهم جدًا
export default app;
