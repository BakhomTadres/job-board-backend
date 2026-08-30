import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

// Initialize Stripe SDK instance with secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
  apiVersion: "2024-12-18.acacia",
});
/**
 * Creates a new Stripe PaymentIntent.
 * 
 * @param {Object} params - Payment details
 * @param {number} params.amount - The amount in main currency units (e.g., USD dollars) or cents.
 *                                 Stripe expects the smallest currency unit (e.g., cents for USD).
 * @param {string} [params.currency='usd'] - Three-letter ISO currency code.
 * @param {Object} [params.metadata={}] - Additional key-value metadata to attach to the PaymentIntent.
 * @returns {Promise<Stripe.PaymentIntent>} The created Stripe PaymentIntent object.
 */
export const createPaymentIntent = async ({ amount, currency = "usd", metadata = {} }) => {
  try {
    // Convert to smallest currency unit (e.g. dollars to cents: $50.00 -> 5000)
    // If the input is already an integer representation of cents, ensure it's rounded properly.
    const amountInSmallestUnit = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency: currency.toLowerCase(),
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error("Stripe Gateway Error [createPaymentIntent]:", error.message);
    throw error;
  }
};

/**
 * Retrieves details of an existing Stripe PaymentIntent by its ID.
 * 
 * @param {string} paymentIntentId - The ID of the PaymentIntent (e.g., 'pi_123456789')
 * @returns {Promise<Stripe.PaymentIntent>} The retrieved PaymentIntent object.
 */
export const retrievePaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error("Stripe Gateway Error [retrievePaymentIntent]:", error.message);
    throw error;
  }
};

/**
 * Constructs and validates a Stripe webhook event from the raw payload and signature.
 * 
 * @param {Buffer|string} rawBody - Raw request body buffer.
 * @param {string} signature - Value of the 'stripe-signature' header.
 * @param {string} [secret] - Stripe webhook endpoint signing secret.
 * @returns {Stripe.Event} Validated Stripe event.
 */
export const constructWebhookEvent = (rawBody, signature, secret = process.env.STRIPE_WEBHOOK_SECRET) => {
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("Stripe Gateway Error [constructWebhookEvent]:", error.message);
    throw error;
  }
};

export default {
  stripe,
  createPaymentIntent,
  retrievePaymentIntent,
  constructWebhookEvent,
};
