import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import userRouter from "./Routes/userRoute.js";
import applicationRoutes from "./Routes/applicationRoute.js";
import jobRouter from "./Routes/jobRoute.js";
import paymentRouter from "./Routes/payment.routes.js";

dotenv.config();

const app = express();

// Enable CORS for frontend integration (Angular, etc.)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/job-board";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

app.use("/api/users", userRouter);
app.use("/api", applicationRoutes);
app.use("/api/jobs", jobRouter);
app.use("/api/payments", paymentRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
