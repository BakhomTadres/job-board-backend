import crypto from "crypto";
import Payment from "../Models/Payment.model.js";
import {
  createIntention,
  getUnifiedCheckoutUrl,
  verifyHmac,
} from "../Services/paymob.gateway.js";

/**
 * Creates a Paymob checkout session by generating a Payment Intention,
 * building the Unified Checkout redirect URL, and saving a pending Payment record in MongoDB.
 * 
 * @route POST /api/payments/create-checkout
 * @access Protected (Requires JWT Authentication)
 */
export const createCheckout = async (req, res) => {
  try {
    const {
      amount,
      currency = process.env.PAYMOB_CURRENCY || "EGP",
      billingData = {},
      items,
      paymentMethods,
      redirectionUrl,
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
    const firstName = billingData.firstName || billingData.first_name || userNames[0] || "Customer";
    const lastName =
      billingData.lastName ||
      billingData.last_name ||
      (userNames.length > 1 ? userNames.slice(1).join(" ") : "User");
    const email = billingData.email || req.user?.email || "customer@example.com";
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
      street: billingData.street || "Street 1",
      building: billingData.building || "1",
      floor: billingData.floor || "1",
      apartment: billingData.apartment || "1",
      city: billingData.city || "Cairo",
      state: billingData.state || "Cairo",
      country: billingData.country || "EGY",
      postal_code: billingData.postalCode || billingData.postal_code || "12345",
    };

    // 4. Call Paymob Intention API to create payment intention
    const intention = await createIntention({
      amount,
      currency,
      paymentMethods,
      billingData: assembledBillingData,
      items,
      specialReference,
      redirectionUrl,
      extras: {
        userId: userId.toString(),
        specialReference,
      },
    });

    const clientSecret = intention.client_secret;
    const intentionId = intention.id || intention.intention_id;
    const intentionOrderId = intention.intention_order_id || intention.order_id || intention.order;

    // 5. Generate Unified Checkout URL
    const checkoutUrl = getUnifiedCheckoutUrl(clientSecret);

    // 6. Create new Payment record in MongoDB with 'pending' status
    const newPayment = await Payment.create({
      userId,
      paymobIntentionId: intentionId ? String(intentionId) : undefined,
      paymobOrderId: intentionOrderId,
      specialReference,
      clientSecret,
      checkoutUrl,
      amount,
      currency: currency.toLowerCase(),
      status: "pending",
      paymentMethod: "card",
      billingData: assembledBillingData,
    });

    // 7. Return checkout session info to client
    return res.status(201).json({
      status: "success",
      message: "Checkout session created successfully.",
      data: {
        paymentId: newPayment._id,
        intentionId: intentionId,
        clientSecret: clientSecret,
        checkoutUrl: checkoutUrl,
        specialReference: specialReference,
        amount: newPayment.amount,
        currency: newPayment.currency,
        status: newPayment.status,
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
 * Handles incoming Paymob webhook events (Transaction Processed Callbacks).
 * Verifies the HMAC-SHA512 signature from the query string using PAYMOB_HMAC_SECRET,
 * then updates the payment status in MongoDB.
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
    if (isVoided) {
      paymentStatus = "canceled";
    } else if (isRefunded) {
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
    }

    // 4. Acknowledge receipt to Paymob
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
 * Retrieves payment details by Payment ID.
 * 
 * @route GET /api/payments/:id
 * @access Protected (Requires JWT Authentication)
 */
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id;

    const payment = await Payment.findById(id);
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
  createCheckout,
  paymobWebhook,
  getPaymentById,
};
