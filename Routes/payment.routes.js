import express from "express";
import {
  createCheckout,
  getPaymobConfig,
  processTestCardPayment,
  paymobWebhook,
  confirmPaymentSession,
  getPaymentById,
} from "../Controllers/payment.controller.js";
import { authenticateUser } from "../Middlewares/auth.js";

const router = express.Router();

/**
 * @route   GET /api/payments/config
 * @route   GET /api/payments/paymob/config
 * @desc    Get public Paymob Sandbox / Test configuration & test card details
 * @access  Public
 */
router.get("/config", getPaymobConfig);
router.get("/paymob/config", getPaymobConfig);

/**
 * @route   POST /api/payments/create-checkout
 * @desc    Create a Paymob Payment Intention, Unified Checkout / Iframe session, and MongoDB record
 * @access  Protected (Requires valid JWT Bearer token)
 */
router.post("/create-checkout", authenticateUser, createCheckout);

/**
 * @route   POST /api/payments/confirm-session
 * @desc    Confirm and verify payment return from Paymob redirection and immediately credit employer
 * @access  Protected (Requires valid JWT Bearer token)
 */
router.post("/confirm-session", authenticateUser, confirmPaymentSession);

/**
 * @route   POST /api/payments/test-pay
 * @desc    Simulate/process test card payment (4000 0000 0000 0002 or 1111 1111 1111 1111) in Sandbox mode
 * @access  Protected (Requires valid JWT Bearer token)
 */
router.post("/test-pay", authenticateUser, processTestCardPayment);

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle incoming Paymob Transaction Processed webhook callbacks
 * @access  Public (Authenticity verified cryptographically via HMAC-SHA512 query param)
 */
router.post("/webhook", paymobWebhook);

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment status and details by payment ID or specialReference
 * @access  Protected (Requires valid JWT Bearer token)
 */
router.get("/:id", authenticateUser, getPaymentById);

export default router;
