import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import userRouter from "./Routes/userRoute.js";
import applicationRoutes from "./Routes/applicationRoute.js";
import jobRouter from "./Routes/jobRoute.js";
import paymentsRouter from "./Routes/payment.routes.js"
dotenv.config();

const app = express();

app.use(express.json());
app.use(cors())
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/job-board";

mongoose.connect(MONGO_URI)
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.error("Error connecting to MongoDB:", err));

app.use("/api/users", userRouter);
app.use("/api", applicationRoutes);
app.use("/api/jobs", jobRouter);
app.use("/api/payments",paymentsRouter)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
