import mongoose from "mongoose";

/**
 * Payment Schema for MongoDB using Mongoose
 * Tracks transaction details, Paymob Intention IDs, Unified Checkout sessions,
 * Iframe URLs, test mode indicators, and payment status lifecycle.
 */
const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    paymobIntentionId: {
      type: String,
      trim: true,
      index: true,
    },
    paymobOrderId: {
      type: mongoose.Schema.Types.Mixed,
      index: true,
    },
    paymobTransactionId: {
      type: mongoose.Schema.Types.Mixed,
      index: true,
    },
    paymobToken: {
      type: String,
      trim: true,
    },
    specialReference: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    clientSecret: {
      type: String,
      trim: true,
    },
    checkoutUrl: {
      type: String,
      trim: true,
    },
    iframeUrl: {
      type: String,
      trim: true,
    },
    iframeId: {
      type: mongoose.Schema.Types.Mixed,
    },
    integrationId: {
      type: mongoose.Schema.Types.Mixed,
    },
    isTestMode: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "egp",
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
    billingData: {
      first_name: String,
      last_name: String,
      phone_number: String,
      email: String,
      street: String,
      building: String,
      floor: String,
      apartment: String,
      city: String,
      state: String,
      country: String,
      postal_code: String,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt fields
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
