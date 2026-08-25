import mongoose from "mongoose";

/**
 * Payment Schema for MongoDB using Mongoose
 * Tracks transaction details, Stripe PaymentIntent IDs, and payment status lifecycle.
 */
const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: [true, "Stripe PaymentIntent ID is required"],
      unique: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "usd",
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "succeeded", "failed", "canceled"],
        message: "Status must be either pending, succeeded, failed, or canceled",
      },
      default: "pending",
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt fields
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
