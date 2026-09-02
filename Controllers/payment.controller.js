import crypto from "crypto";
import mongoose from "mongoose";
import Payment from "../Models/Payment.model.js";
import User from "../Models/userModel.js";
import {
  createIntention,
  getUnifiedCheckoutUrl,
  getIframeUrl,
  isTestMode,
  isTestCard,
  PAYMOB_TEST_CARDS,
  PAYMOB_INTEGRATION_ID,
  PAYMOB_IFRAME_ID,
  PAYMOB_PUBLIC_KEY,
  PAYMOB_CURRENCY,
  PAYMOB_BASE_URL,
  verifyHmac,
} from "../Services/paymob.gateway.js";

/**
 * Helper function to activate plan benefits for a user upon confirmed payment success.
 * - Single Job (starter / featured): adds +1 to user.jobCredits
 * - Unlimited (unlimited): activates subscription for 30 days
 * Guaranteed idempotent via payment.isProcessed flag.
 */
export const applyPaymentPlanToUser = async (payment) => {
  try {
    if (!payment || !payment.userId) return null;
    if (payment.isProcessed) {
      console.log(`Payment ${payment._id} has already been processed for user plan.`);
      return await User.findById(payment.userId);
    }

    const user = await User.findById(payment.userId);
    if (!user) {
      console.warn(`User ${payment.userId} not found for payment ${payment._id}`);
      return null;
    }

    const plan = String(payment.planId || "starter").toLowerCase();

    if (plan === "weekly" || plan === "featured") {
      // Weekly Subscription (7 days unlimited posting)
      const now = Date.now();
      const currentExpiry =
        user.subscription?.expiresAt && user.subscription?.isActive
          ? new Date(user.subscription.expiresAt).getTime()
          : 0;
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiresAt = new Date(baseDate + 7 * 24 * 60 * 60 * 1000);

      user.subscription = {
        plan: "weekly",
        isActive: true,
        expiresAt: newExpiresAt,
      };
    } else if (plan === "unlimited" || plan === "monthly") {
      // Monthly Subscription (30 days unlimited posting)
      const now = Date.now();
      const currentExpiry =
        user.subscription?.expiresAt && user.subscription?.isActive
          ? new Date(user.subscription.expiresAt).getTime()
          : 0;
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiresAt = new Date(baseDate + 30 * 24 * 60 * 60 * 1000);

      user.subscription = {
        plan: "unlimited",
        isActive: true,
        expiresAt: newExpiresAt,
      };
    } else {
      // Single job package (starter, single, etc.)
      user.jobCredits = (user.jobCredits || 0) + 1;
      if (!user.subscription) {
        user.subscription = {
          plan: plan,
          isActive: false,
        };
      } else {
        user.subscription.plan = plan;
      }
    }

    await user.save();

    payment.isProcessed = true;
    await payment.save();

    console.log(
      `Activated plan '${plan}' for user ${user._id}. Current credits: ${user.jobCredits}, isSubscribed: ${user.subscription?.isActive}`
    );
    return user;
  } catch (error) {
    console.error(`Error in applyPaymentPlanToUser for payment ${payment?._id}:`, error);
    throw error;
  }
};

/**
 * Creates a Paymob checkout session configured for Sandbox / Testing or Live mode.
 * Generates both Unified Checkout redirect URL and embedded Iframe URL with test Integration & Iframe IDs.
 * 
 * @route POST /api/payments/create-checkout
 * @access Protected (Requires JWT Authentication)
 */
export const createCheckout = async (req, res) => {
  try {
    const {
      amount,
      currency = process.env.PAYMOB_CURRENCY || PAYMOB_CURRENCY || "EGP",
      billingData = {},
      items,
      paymentMethods,
      redirectionUrl,
      iframeId = process.env.PAYMOB_IFRAME_ID || PAYMOB_IFRAME_ID || "789123",
      integrationId = process.env.PAYMOB_INTEGRATION_ID || PAYMOB_INTEGRATION_ID || "456789",
      planId = "starter",
    } = req.body;

    // 1. Validate request payload
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        status: "fail",
        message: "A valid positive number for amount is required.",
      });
    }

    // 2. Identify the authenticated user
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: "fail",
        message: "Unauthorized: User information not found in request.",
      });
    }

    // Generate unique internal reference for this transaction
    const specialReference = `ORDER-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // 3. Assemble billing data combining req.user info with any custom billing data provided
    const userNames = (req.user?.name || "").trim().split(" ");
    const firstName = billingData.firstName || billingData.first_name || userNames[0] || "Test";
    const lastName =
      billingData.lastName ||
      billingData.last_name ||
      (userNames.length > 1 ? userNames.slice(1).join(" ") : "Customer");
    const email = billingData.email || req.user?.email || "test.customer@example.com";
    const phoneNumber =
      billingData.phoneNumber ||
      billingData.phone_number ||
      req.user?.phoneNumber ||
      req.user?.phone ||
      "+201000000000";

    const assembledBillingData = {
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone_number: phoneNumber,
      street: billingData.street || "Test Street",
      building: billingData.building || "1",
      floor: billingData.floor || "1",
      apartment: billingData.apartment || "1",
      city: billingData.city || "Cairo",
      state: billingData.state || "Cairo",
      country: billingData.country || "EGY",
      postal_code: billingData.postalCode || billingData.postal_code || "12345",
    };

    const inTest = isTestMode();
    const effectiveIntegrationId = integrationId || process.env.PAYMOB_INTEGRATION_ID || "456789";
    const effectiveIframeId = iframeId || process.env.PAYMOB_IFRAME_ID || "789123";

    // 4. Call Paymob Intention API to create payment intention
    const intention = await createIntention({
      amount,
      currency,
      paymentMethods: paymentMethods || [Number(effectiveIntegrationId) || effectiveIntegrationId],
      billingData: assembledBillingData,
      items,
      specialReference,
      redirectionUrl,
      extras: {
        userId: userId.toString(),
        planId: String(planId || "starter"),
        specialReference,
        isTestMode: inTest,
      },
    });

    const clientSecret = intention.client_secret || `cs_test_${crypto.randomBytes(16).toString("hex")}`;
    const intentionId = intention.id || intention.intention_id;
    const intentionOrderId = intention.intention_order_id || intention.order_id || intention.order;
    const paymentToken = intention.payment_token || clientSecret;

    // 5. Generate Checkout URLs
    const checkoutUrl = getUnifiedCheckoutUrl(clientSecret);
    const iframeUrl = getIframeUrl(effectiveIframeId, paymentToken);

    // 6. Create new Payment record in MongoDB with 'pending' status
    const newPayment = await Payment.create({
      userId,
      planId: String(planId || "starter"),
      isProcessed: false,
      paymobIntentionId: intentionId ? String(intentionId) : undefined,
      paymobOrderId: intentionOrderId,
      paymobToken: paymentToken,
      specialReference,
      clientSecret,
      checkoutUrl,
      iframeUrl,
      iframeId: effectiveIframeId,
      integrationId: effectiveIntegrationId,
      isTestMode: inTest,
      amount,
      currency: currency.toLowerCase(),
      status: "pending",
      paymentMethod: "card",
      billingData: assembledBillingData,
    });

    // 7. Return checkout session info with testing guidance
    return res.status(201).json({
      status: "success",
      message: inTest
        ? "Paymob sandbox checkout session created. Test cards ready to use without live charge errors."
        : "Checkout session created successfully.",
      data: {
        paymentId: newPayment._id,
        planId: newPayment.planId,
        intentionId: intentionId,
        clientSecret: clientSecret,
        checkoutUrl: checkoutUrl,
        iframeUrl: iframeUrl,
        iframeId: effectiveIframeId,
        integrationId: effectiveIntegrationId,
        specialReference: specialReference,
        amount: newPayment.amount,
        currency: newPayment.currency,
        status: newPayment.status,
        isTestMode: inTest,
        ...(inTest
          ? {
              sandboxInfo: {
                notice: "Sandbox/Testing mode is active. No real card will be charged.",
                testCards: PAYMOB_TEST_CARDS,
              },
            }
          : {}),
      },
    });
  } catch (error) {
    console.error("Error in createCheckout controller:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create checkout session.",
    });
  }
};

/**
 * Returns public configuration for Paymob sandbox and testing.
 * 
 * @route GET /api/payments/config
 * @access Public
 */
export const getPaymobConfig = (req, res) => {
  try {
    const inTest = isTestMode();
    return res.status(200).json({
      status: "success",
      data: {
        mode: inTest ? "sandbox" : "live",
        isTestMode: inTest,
        publicKey: PAYMOB_PUBLIC_KEY || "egy_pk_test_placeholder",
        integrationId: PAYMOB_INTEGRATION_ID || "456789",
        iframeId: PAYMOB_IFRAME_ID || "789123",
        currency: PAYMOB_CURRENCY || "EGP",
        baseUrl: PAYMOB_BASE_URL,
        testCards: inTest ? PAYMOB_TEST_CARDS : [],
      },
    });
  } catch (error) {
    console.error("Error in getPaymobConfig controller:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to load Paymob configuration.",
    });
  }
};

/**
 * Processes a test payment directly with Paymob default test cards in Sandbox mode.
 * 
 * @route POST /api/payments/test-pay
 * @access Protected (Requires JWT Authentication)
 */
export const processTestCardPayment = async (req, res) => {
  try {
    const { paymentId, cardNumber, cardHolder, expiryMonth = "12", expiryYear = "28", cvv = "123", simulateStatus } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        status: "fail",
        message: "paymentId is required.",
      });
    }

    const cleanCard = String(cardNumber || "").replace(/\s+/g, "");
    if (!cleanCard) {
      return res.status(400).json({
        status: "fail",
        message: "Test card number is required (e.g. 4000 0000 0000 0002 or 1111 1111 1111 1111).",
      });
    }

    const validTest = isTestCard(cleanCard);
    if (!validTest) {
      return res.status(400).json({
        status: "fail",
        message:
          "Invalid test card number. In Sandbox mode, please use Paymob test cards: 4000 0000 0000 0002 or 1111 1111 1111 1111.",
      });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: "Payment record not found.",
      });
    }

    const finalStatus = simulateStatus === "failed" ? "failed" : "succeeded";
    const maskedPan = `xxxx-xxxx-xxxx-${cleanCard.slice(-4)}`;
    const mockTxId = Math.floor(10000000 + Math.random() * 90000000);

    payment.status = finalStatus;
    payment.paymobTransactionId = mockTxId;
    payment.paymentMethod = cleanCard.startsWith("4") ? "Visa (Sandbox)" : "MasterCard (Sandbox)";
    await payment.save();

    let updatedUser = null;
    if (finalStatus === "succeeded") {
      updatedUser = await applyPaymentPlanToUser(payment);
    }

    return res.status(200).json({
      status: "success",
      message: `Test payment processed successfully in Sandbox mode. Status: ${finalStatus}`,
      data: {
        paymentId: payment._id,
        transactionId: mockTxId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        planId: payment.planId,
        jobCredits: updatedUser ? updatedUser.jobCredits : undefined,
        subscription: updatedUser ? updatedUser.subscription : undefined,
        card: {
          maskedPan,
          cardHolder: cardHolder || "Test User",
          expiry: `${expiryMonth}/${expiryYear}`,
          type: cleanCard.startsWith("4") ? "Visa Test Card" : "MasterCard Test Card",
        },
        mode: "sandbox",
      },
    });
  } catch (error) {
    console.error("Error in processTestCardPayment controller:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to process test card payment.",
    });
  }
};

/**
 * Handles incoming Paymob webhook events (Transaction Processed Callbacks).
 * 
 * @route POST /api/payments/webhook
 * @access Public (Protected by HMAC SHA-512 Signature Verification)
 */
export const paymobWebhook = async (req, res) => {
  try {
    const receivedHmac = req.query.hmac || req.headers["hmac"];

    if (!receivedHmac) {
      console.warn("Paymob webhook received without 'hmac' parameter.");
      return res.status(400).json({
        status: "fail",
        message: "Missing 'hmac' query parameter in webhook request.",
      });
    }

    const transactionObj = req.body.obj || req.body;

    // 1. Verify HMAC SHA-512 signature
    const isValid = verifyHmac(transactionObj, receivedHmac);
    if (!isValid) {
      console.error("Paymob webhook signature verification failed.");
      return res.status(400).json({
        status: "fail",
        message: "Invalid HMAC signature.",
      });
    }

    // 2. Extract transaction details
    const transactionId = transactionObj.id;
    const specialReference =
      transactionObj.special_reference ||
      transactionObj.order?.merchant_order_id ||
      transactionObj.payment_key_claims?.extra?.specialReference ||
      transactionObj.payment_key_claims?.extra?.special_reference;
    const orderId = transactionObj.order?.id;
    const intentionId = transactionObj.intention_id;

    const isSuccess =
      transactionObj.success === true ||
      transactionObj.success === "true" ||
      transactionObj.success === 1;
    const isPending =
      transactionObj.pending === true ||
      transactionObj.pending === "true" ||
      transactionObj.pending === 1;
    const isVoided =
      transactionObj.is_voided === true ||
      transactionObj.is_voided === "true";
    const isRefunded =
      transactionObj.is_refunded === true ||
      transactionObj.is_refunded === "true";

    let paymentStatus = "pending";
    if (isVoided || isRefunded) {
      paymentStatus = "canceled";
    } else if (isSuccess && !isPending) {
      paymentStatus = "succeeded";
    } else if (!isSuccess && !isPending) {
      paymentStatus = "failed";
    }

    const paymentMethod =
      transactionObj.source_data?.sub_type ||
      transactionObj.source_data?.type ||
      "card";

    // 3. Find and update corresponding Payment record
    const filterQuery = [];
    if (specialReference) {
      filterQuery.push({ specialReference });
    }
    if (orderId) {
      filterQuery.push({ paymobOrderId: orderId });
    }
    if (intentionId) {
      filterQuery.push({ paymobIntentionId: String(intentionId) });
    }

    let updatedPayment = null;
    if (filterQuery.length > 0) {
      updatedPayment = await Payment.findOneAndUpdate(
        { $or: filterQuery },
        {
          status: paymentStatus,
          paymobTransactionId: transactionId,
          paymentMethod: paymentMethod,
          ...(orderId ? { paymobOrderId: orderId } : {}),
        },
        { new: true }
      );
    }

    if (!updatedPayment) {
      console.warn("Paymob webhook: Corresponding payment record not found for transaction:", {
        transactionId,
        specialReference,
        orderId,
        intentionId,
      });
    } else {
      console.log(`Paymob payment ${updatedPayment._id} status updated to '${paymentStatus}'.`);

      if (paymentStatus === "succeeded") {
        await applyPaymentPlanToUser(updatedPayment);
      }
    }

    return res.status(200).json({
      status: "success",
      received: true,
    });
  } catch (error) {
    console.error("Error processing Paymob webhook event:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while processing webhook event.",
    });
  }
};

/**
 * Confirms payment completion upon browser redirection from Paymob Unified Checkout.
 * Ensures the payment is marked succeeded and user credits are applied immediately,
 * even when webhook cannot reach localhost directly.
 * 
 * @route POST /api/payments/confirm-session
 * @access Protected (Requires JWT Authentication)
 */
export const confirmPaymentSession = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { paymentId, reference, transactionId, orderId, success } = req.body;

    const queryOr = [];
    if (paymentId && mongoose.Types.ObjectId.isValid(paymentId)) {
      queryOr.push({ _id: paymentId });
    }
    if (reference) {
      queryOr.push({ specialReference: reference });
    }
    if (orderId) {
      queryOr.push({ paymobOrderId: orderId });
    }
    if (transactionId) {
      queryOr.push({ paymobTransactionId: transactionId });
    }

    if (queryOr.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Payment reference, paymentId, or transactionId is required.",
      });
    }

    let payment = await Payment.findOne({ $or: queryOr });
    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: "Payment record not found.",
      });
    }

    if (payment.userId.toString() !== userId.toString() && req.user?.role !== "admin") {
      return res.status(403).json({
        status: "fail",
        message: "Unauthorized to access this payment record.",
      });
    }

    const isSuccess = success === true || success === "true" || success === undefined;

    if (isSuccess && payment.status !== "failed" && payment.status !== "canceled") {
      payment.status = "succeeded";
      if (transactionId && !payment.paymobTransactionId) {
        payment.paymobTransactionId = transactionId;
      }
      if (orderId && !payment.paymobOrderId) {
        payment.paymobOrderId = orderId;
      }
      await payment.save();

      const updatedUser = await applyPaymentPlanToUser(payment);

      return res.status(200).json({
        status: "success",
        message: "Payment verified and employer credits updated successfully.",
        data: payment,
        user: {
          jobCredits: updatedUser?.jobCredits,
          subscription: updatedUser?.subscription,
        },
      });
    }

    return res.status(200).json({
      status: "success",
      data: payment,
    });
  } catch (error) {
    console.error("Error in confirmPaymentSession controller:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to confirm payment session.",
    });
  }
};

/**
 * Retrieves payment details by Payment ID or Reference.
 * 
 * @route GET /api/payments/:id
 * @access Protected (Requires JWT Authentication)
 */
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id;

    let payment = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      payment = await Payment.findById(id);
    }
    if (!payment) {
      payment = await Payment.findOne({
        $or: [
          { specialReference: id },
          { paymobTransactionId: id },
          { paymobOrderId: id },
        ],
      });
    }

    if (!payment) {
      return res.status(404).json({
        status: "fail",
        message: "Payment record not found.",
      });
    }

    // Ensure the authenticated user owns this payment record (or is admin)
    if (payment.userId.toString() !== userId.toString() && req.user?.role !== "admin") {
      return res.status(403).json({
        status: "fail",
        message: "Unauthorized to access this payment record.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: payment,
    });
  } catch (error) {
    console.error("Error in getPaymentById controller:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to retrieve payment.",
    });
  }
};

export default {
  applyPaymentPlanToUser,
  createCheckout,
  getPaymobConfig,
  processTestCardPayment,
  paymobWebhook,
  confirmPaymentSession,
  getPaymentById,
};
