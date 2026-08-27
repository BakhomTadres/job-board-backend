import Payment from "../Models/Payment.model.js";
import {
  createPaymentIntent,
  constructWebhookEvent,
} from "../Services/stripe.gateway.js";

/**
 * Creates a checkout session by generating a Stripe PaymentIntent
 * and saving a corresponding pending Payment record in MongoDB.
 * 
 * @route POST /api/payments/create-checkout
 * @access Protected (Requires JWT Authentication)
 */
export const createCheckout = async (req, res) => {
  try {
    const { amount, currency = "usd" } = req.body;

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

    // 3. Create Stripe PaymentIntent via gateway service
    const paymentIntent = await createPaymentIntent({
      amount,
      currency,
      metadata: {
        userId: userId.toString(),
      },
    });

    // 4. Create new Payment record in MongoDB with 'pending' status
    const newPayment = await Payment.create({
      userId,
      stripePaymentIntentId: paymentIntent.id,
      amount,
      currency: currency.toLowerCase(),
      status: "pending",
      paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
    });

    // 5. Respond with clientSecret and paymentIntentId for client-side Stripe confirmation
    return res.status(201).json({
      status: "success",
      message: "Checkout session created successfully.",
      data: {
        paymentId: newPayment._id,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
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
 * Handles incoming Stripe webhook events.
 * Verifies the webhook signature using STRIPE_WEBHOOK_SECRET,
 * then updates the payment status in MongoDB based on event type.
 * 
 * @route POST /api/payments/webhook
 * @access Public (Protected by Stripe Signature Verification)
 */
export const stripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).json({
      status: "fail",
      message: "Missing 'stripe-signature' header in webhook request.",
    });
  }

  let event;

  // 1. Verify webhook signature and construct event from raw request body
  try {
    // Preserves raw Buffer/string (handled via express.raw() or rawBody)
    const payload = req.rawBody || req.body;
    event = constructWebhookEvent(payload, signature);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. Handle specific Stripe event types
  try {
    const paymentIntent = event.data.object;

    switch (event.type) {
      // Payment succeeded event
      case "payment_intent.succeeded": {
        console.log(`PaymentIntent succeeded: ${paymentIntent.id}`);

        const paymentMethod =
          paymentIntent.payment_method_types?.[0] ||
          (typeof paymentIntent.payment_method === "string"
            ? paymentIntent.payment_method
            : "card");

        const updatedPayment = await Payment.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntent.id },
          {
            status: "succeeded",
            paymentMethod,
          },
          { new: true }
        );

        if (!updatedPayment) {
          console.warn(
            `Payment record with stripePaymentIntentId ${paymentIntent.id} not found.`
          );
        } else {
          console.log(
            `Payment ${updatedPayment._id} status updated to 'succeeded'.`
          );
        }
        break;
      }

      // Payment failed event
      case "payment_intent.payment_failed": {
        const failureMessage =
          paymentIntent.last_payment_error?.message || "Payment attempt failed";
        console.log(
          `PaymentIntent failed: ${paymentIntent.id}. Reason: ${failureMessage}`
        );

        const updatedPayment = await Payment.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntent.id },
          { status: "failed" },
          { new: true }
        );

        if (!updatedPayment) {
          console.warn(
            `Payment record with stripePaymentIntentId ${paymentIntent.id} not found.`
          );
        } else {
          console.log(
            `Payment ${updatedPayment._id} status updated to 'failed'.`
          );
        }
        break;
      }

      // Payment canceled event
      case "payment_intent.canceled": {
        console.log(`PaymentIntent canceled: ${paymentIntent.id}`);

        const updatedPayment = await Payment.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntent.id },
          { status: "canceled" },
          { new: true }
        );

        if (!updatedPayment) {
          console.warn(
            `Payment record with stripePaymentIntentId ${paymentIntent.id} not found.`
          );
        } else {
          console.log(
            `Payment ${updatedPayment._id} status updated to 'canceled'.`
          );
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event type received: ${event.type}`);
    }

    // 3. Acknowledge receipt of the event to Stripe
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook event:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error while processing webhook event.",
    });
  }
};

export default {
  createCheckout,
  stripeWebhook,
};
