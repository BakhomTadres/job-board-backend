import express from "express";
import {
  createCheckout,
  paymobWebhook,
  getPaymentById,
} from "../Controllers/payment.controller.js";
import { authenticateUser } from "../Middlewares/auth.js";

const router = express.Router();

/**
 * @route   POST /api/payments/create-checkout
 * @desc    Create a Paymob Payment Intention, Unified Checkout session, and MongoDB payment record
 * @access  Protected (Requires valid JWT Bearer token)
 */
router.post("/create-checkout", authenticateUser, createCheckout);

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle incoming Paymob Transaction Processed webhook callbacks
 * @access  Public (Authenticity verified cryptographically via HMAC-SHA512 query param)
 */
router.post("/webhook", paymobWebhook);

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment status and details by payment ID
 * @access  Protected (Requires valid JWT Bearer token)
 */
router.get("/:id", authenticateUser, getPaymentById);

export default router;
