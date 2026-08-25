import express from "express";
import {
  createCheckout,
  stripeWebhook,
} from "../Controllers/payment.controller.js";
import { authenticateUser } from "../Middlewares/auth.js";

const router = express.Router();

/**
 * @route   POST /api/payments/create-checkout
 * @desc    Create a Stripe PaymentIntent and MongoDB payment record
 * @access  Protected (Requires valid JWT Bearer token)
 */
router.post("/create-checkout", authenticateUser, createCheckout);

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle incoming Stripe webhook events (verification + database status update)
 * @access  Public (Signature verified via stripe-signature header)
 * @note    Uses express.raw({ type: 'application/json' }) middleware specifically on this route
 *          to preserve raw request body buffer required for Stripe cryptographic signature verification.
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

export default router;
