import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Paymob Payment Gateway Service
 * Handles Intention API interactions, Unified Checkout URL generation,
 * and SHA-512 HMAC webhook verification according to official Paymob specs.
 */

const PAYMOB_BASE_URL = process.env.PAYMOB_BASE_URL || "https://accept.paymob.com";
const PAYMOB_SECRET_KEY = process.env.PAYMOB_SECRET_KEY || "";
const PAYMOB_PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY || "";
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || "";
const PAYMOB_CURRENCY = process.env.PAYMOB_CURRENCY || "EGP";

/**
 * Creates a payment intention using the official Paymob Intention API.
 * 
 * @param {Object} params - Intention creation parameters
 * @param {number} params.amount - Total amount in standard currency units (e.g. 100 for 100.00 EGP)
 * @param {string} [params.currency] - ISO currency code (default: EGP)
 * @param {Array<number|string>} [params.paymentMethods] - List of Integration IDs (numbers) or method names (e.g. ['card'])
 * @param {Object} [params.billingData] - Customer billing information
 * @param {Array<Object>} [params.items] - List of order items
 * @param {string} [params.specialReference] - Internal merchant reference/order ID for correlation
 * @param {string} [params.notificationUrl] - Webhook callback URL
 * @param {string} [params.redirectionUrl] - Customer redirect URL after payment
 * @param {Object} [params.extras] - Custom merchant metadata
 * @returns {Promise<Object>} The Paymob Intention response object containing client_secret, id, etc.
 */
export const createIntention = async ({
  amount,
  currency = PAYMOB_CURRENCY,
  paymentMethods,
  billingData = {},
  items,
  specialReference,
  notificationUrl,
  redirectionUrl,
  extras = {},
}) => {
  try {
    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new Error("Amount must be a positive number.");
    }

    const secretKey = process.env.PAYMOB_SECRET_KEY || PAYMOB_SECRET_KEY;
    if (!secretKey) {
      throw new Error("PAYMOB_SECRET_KEY is not configured in environment variables.");
    }

    const baseUrl = process.env.PAYMOB_BASE_URL || PAYMOB_BASE_URL;

    // Convert amount to cents (smallest currency unit, e.g. 100.00 EGP -> 10000)
    const amountInCents = Math.round(amount * 100);

    // Determine payment methods (Integration IDs as numbers or method strings)
    let methods = paymentMethods;
    if (!methods || (Array.isArray(methods) && methods.length === 0)) {
      if (process.env.PAYMOB_INTEGRATION_ID) {
        const parsedId = Number(process.env.PAYMOB_INTEGRATION_ID);
        methods = [!isNaN(parsedId) ? parsedId : process.env.PAYMOB_INTEGRATION_ID];
      } else {
        methods = ["card"];
      }
    }

    // Prepare billing data with safe defaults for required fields
    const formattedBillingData = {
      first_name: billingData.first_name || billingData.firstName || "Customer",
      last_name: billingData.last_name || billingData.lastName || "User",
      phone_number: billingData.phone_number || billingData.phoneNumber || "+201000000000",
      email: billingData.email || "customer@example.com",
      street: billingData.street || "NA",
      building: billingData.building || "NA",
      floor: billingData.floor || "NA",
      apartment: billingData.apartment || "NA",
      city: billingData.city || "Cairo",
      state: billingData.state || "Cairo",
      country: billingData.country || "EGY",
      postal_code: billingData.postal_code || billingData.postalCode || "NA",
    };

    // Prepare items array
    const formattedItems = items && Array.isArray(items) && items.length > 0
      ? items.map((item) => ({
          name: item.name || "Item",
          amount: typeof item.amount === "number" ? Math.round(item.amount * 100) : amountInCents,
          description: item.description || "Order Item",
          quantity: item.quantity || 1,
        }))
      : [
          {
            name: "Order Payment",
            amount: amountInCents,
            description: `Payment for order ${specialReference || "Job Board"}`,
            quantity: 1,
          },
        ];

    const payload = {
      amount: amountInCents,
      currency: currency.toUpperCase(),
      payment_methods: methods,
      items: formattedItems,
      billing_data: formattedBillingData,
      ...(specialReference ? { special_reference: specialReference } : {}),
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      ...(redirectionUrl ? { redirection_url: redirectionUrl } : {}),
      ...(extras && Object.keys(extras).length > 0 ? { extras } : {}),
    };

    const response = await fetch(`${baseUrl}/v1/intention/`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Paymob Intention API Error Response:", responseData);
      const errorMessage =
        responseData.detail ||
        responseData.message ||
        (Array.isArray(responseData) ? responseData.join(", ") : JSON.stringify(responseData));
      throw new Error(`Paymob Intention API failed (${response.status}): ${errorMessage}`);
    }

    return responseData;
  } catch (error) {
    console.error("Paymob Gateway Error [createIntention]:", error.message);
    throw error;
  }
};

/**
 * Builds the Unified Checkout URL for hosted Paymob checkout.
 * 
 * @param {string} clientSecret - The client_secret returned from the Intention API
 * @param {string} [publicKey] - Paymob public key (defaults to PAYMOB_PUBLIC_KEY env var)
 * @param {string} [baseUrl] - Paymob base URL
 * @returns {string} The complete Unified Checkout URL
 */
export const getUnifiedCheckoutUrl = (
  clientSecret,
  publicKey = process.env.PAYMOB_PUBLIC_KEY || PAYMOB_PUBLIC_KEY,
  baseUrl = process.env.PAYMOB_BASE_URL || PAYMOB_BASE_URL
) => {
  if (!clientSecret) {
    throw new Error("clientSecret is required to generate Unified Checkout URL.");
  }
  return `${baseUrl}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${clientSecret}`;
};

/**
 * Verifies Paymob's SHA-512 HMAC signature for webhook notifications.
 * 
 * Paymob concatenates 20 specific transaction fields from `req.body.obj` in exact order:
 * 1. amount_cents
 * 2. created_at
 * 3. currency
 * 4. error_occured
 * 5. has_parent_transaction
 * 6. id
 * 7. integration_id
 * 8. is_3d_secure
 * 9. is_auth
 * 10. is_capture
 * 11. is_refunded
 * 12. is_standalone_payment
 * 13. is_voided
 * 14. order.id (nested: obj.order.id)
 * 15. owner
 * 16. pending
 * 17. source_data.pan (nested: obj.source_data.pan)
 * 18. source_data.sub_type (nested: obj.source_data.sub_type)
 * 19. source_data.type (nested: obj.source_data.type)
 * 20. success
 * 
 * @param {Object} obj - The transaction object received in `req.body.obj` or `req.body`
 * @param {string} receivedHmac - The HMAC hash received via query param `req.query.hmac` or header
 * @param {string} [hmacSecret] - The Paymob HMAC secret from dashboard settings
 * @returns {boolean} True if HMAC signature matches, false otherwise
 */
export const verifyHmac = (
  obj,
  receivedHmac,
  hmacSecret = process.env.PAYMOB_HMAC_SECRET || PAYMOB_HMAC_SECRET
) => {
  try {
    if (!obj || typeof obj !== "object") {
      console.error("Paymob HMAC Verification Error: Invalid transaction object.");
      return false;
    }

    if (!receivedHmac || typeof receivedHmac !== "string") {
      console.error("Paymob HMAC Verification Error: Missing or invalid received HMAC.");
      return false;
    }

    if (!hmacSecret) {
      console.error("Paymob HMAC Verification Error: PAYMOB_HMAC_SECRET is not configured.");
      return false;
    }

    // Helper function to format values to string per Paymob spec
    const formatValue = (val) => {
      if (val === undefined || val === null) {
        return "";
      }
      if (typeof val === "boolean") {
        return val ? "true" : "false";
      }
      return String(val);
    };

    // Pull 20 fields in exact specified concatenation order
    const concatenatedString = [
      formatValue(obj.amount_cents),
      formatValue(obj.created_at),
      formatValue(obj.currency),
      formatValue(obj.error_occured),
      formatValue(obj.has_parent_transaction),
      formatValue(obj.id),
      formatValue(obj.integration_id),
      formatValue(obj.is_3d_secure),
      formatValue(obj.is_auth),
      formatValue(obj.is_capture),
      formatValue(obj.is_refunded),
      formatValue(obj.is_standalone_payment),
      formatValue(obj.is_voided),
      formatValue(obj.order?.id ?? obj.order_id ?? ""),
      formatValue(obj.owner),
      formatValue(obj.pending),
      formatValue(obj.source_data?.pan ?? ""),
      formatValue(obj.source_data?.sub_type ?? ""),
      formatValue(obj.source_data?.type ?? ""),
      formatValue(obj.success),
    ].join("");

    // Calculate HMAC-SHA512
    const calculatedHmac = crypto
      .createHmac("sha512", hmacSecret)
      .update(concatenatedString)
      .digest("hex");

    const match = calculatedHmac.toLowerCase() === receivedHmac.toLowerCase();
    if (!match) {
      console.warn("Paymob HMAC Mismatch:", {
        calculated: calculatedHmac.toLowerCase(),
        received: receivedHmac.toLowerCase(),
      });
    }

    return match;
  } catch (error) {
    console.error("Paymob Gateway Error [verifyHmac]:", error.message);
    return false;
  }
};

/**
 * Retrieves details of an existing transaction from Paymob.
 * 
 * @param {string|number} transactionId - The Paymob transaction ID
 * @param {string} [apiKey] - Paymob API key or Secret key
 * @returns {Promise<Object>} Transaction details object
 */
export const retrieveTransaction = async (
  transactionId,
  secretKey = process.env.PAYMOB_SECRET_KEY || PAYMOB_SECRET_KEY,
  baseUrl = process.env.PAYMOB_BASE_URL || PAYMOB_BASE_URL
) => {
  try {
    const response = await fetch(`${baseUrl}/api/acceptance/transactions/${transactionId}`, {
      method: "GET",
      headers: {
        "Authorization": `Token ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve transaction (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.error("Paymob Gateway Error [retrieveTransaction]:", error.message);
    throw error;
  }
};

export default {
  createIntention,
  getUnifiedCheckoutUrl,
  verifyHmac,
  retrieveTransaction,
};
