import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Paymob Payment Gateway Service
 * Handles Intention API interactions, Unified Checkout URL generation,
 * Paymob Iframe generation, Test/Sandbox Card helpers, and SHA-512 HMAC webhook verification.
 */

export const PAYMOB_BASE_URL = process.env.PAYMOB_BASE_URL || "https://accept.paymob.com";
export const PAYMOB_SECRET_KEY = process.env.PAYMOB_SECRET_KEY || "";
export const PAYMOB_PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY || "";
export const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY || "";
export const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID || "";
export const PAYMOB_IFRAME_ID = process.env.PAYMOB_IFRAME_ID || "";
export const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || "";
export const PAYMOB_CURRENCY = process.env.PAYMOB_CURRENCY || "EGP";

/**
 * Paymob Official Default Test Cards for Sandbox / Testing Mode
 */
export const PAYMOB_TEST_CARDS = [
  {
    type: "Visa",
    cardNumber: "4000000000000002",
    formattedNumber: "4000 0000 0000 0002",
    expiryMonth: "12",
    expiryYear: "28",
    cvv: "123",
    cardHolder: "Test User",
    otp3DS: "123456",
    scenario: "Approved / 3DS Successful Payment",
  },
  {
    type: "MasterCard",
    cardNumber: "1111111111111111",
    formattedNumber: "1111 1111 1111 1111",
    expiryMonth: "12",
    expiryYear: "28",
    cvv: "111",
    cardHolder: "Test User",
    otp3DS: "111111",
    scenario: "Alternative Test Card / Approved Payment",
  },
  {
    type: "MasterCard",
    cardNumber: "5123456789012346",
    formattedNumber: "5123 4567 8901 2346",
    expiryMonth: "01",
    expiryYear: "29",
    cvv: "123",
    cardHolder: "Test Account",
    otp3DS: "123456",
    scenario: "Frictionless / Auto-Approved 3DS",
  },
];

/**
 * Checks if the system is currently configured in Test or Sandbox mode.
 * @returns {boolean}
 */
export const isTestMode = () => {
  const envMode = (process.env.PAYMOB_MODE || process.env.PAYMOB_ENVIRONMENT || "sandbox").toLowerCase();
  const secretKey = (process.env.PAYMOB_SECRET_KEY || "").toLowerCase();
  const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase();

  return (
    envMode === "test" ||
    envMode === "sandbox" ||
    secretKey.includes("test") ||
    secretKey.includes("placeholder") ||
    !process.env.PAYMOB_SECRET_KEY ||
    nodeEnv !== "production"
  );
};

/**
 * Checks if a provided card number matches Paymob default test cards.
 * @param {string} cardNumber
 * @returns {boolean}
 */
export const isTestCard = (cardNumber) => {
  if (!cardNumber) return false;
  const sanitized = String(cardNumber).replace(/\s+/g, "");
  return (
    sanitized === "4000000000000002" ||
    sanitized === "1111111111111111" ||
    sanitized === "5123456789012346"
  );
};

/**
 * Returns Paymob test card list and instructions for sandbox testing.
 * @returns {Array<Object>}
 */
export const getPaymobTestCards = () => {
  return PAYMOB_TEST_CARDS;
};

/**
 * Generates Paymob Classic Iframe URL for embedded or redirected checkout.
 * 
 * @param {string} [iframeId] - Paymob Iframe ID (defaults to PAYMOB_IFRAME_ID)
 * @param {string} paymentToken - The payment key token generated for the transaction
 * @param {string} [baseUrl] - Paymob base URL
 * @returns {string} The full Iframe URL
 */
export const getIframeUrl = (
  iframeId = process.env.PAYMOB_IFRAME_ID || PAYMOB_IFRAME_ID,
  paymentToken,
  baseUrl = process.env.PAYMOB_BASE_URL || PAYMOB_BASE_URL
) => {
  const finalIframeId = iframeId || process.env.PAYMOB_IFRAME_ID || "789123";
  if (!paymentToken) {
    throw new Error("paymentToken is required to generate Paymob Iframe URL.");
  }
  return `${baseUrl}/api/acceptance/iframes/${finalIframeId}?payment_token=${paymentToken}`;
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
 * Creates a payment intention using the official Paymob Intention API (v1).
 * In sandbox mode with placeholder keys, provides safe sandbox simulation to prevent live charge failures.
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
      first_name: billingData.first_name || billingData.firstName || "Test",
      last_name: billingData.last_name || billingData.lastName || "Customer",
      phone_number: billingData.phone_number || billingData.phoneNumber || "+201000000000",
      email: billingData.email || "test.customer@example.com",
      street: billingData.street || "Test Street",
      building: billingData.building || "1",
      floor: billingData.floor || "1",
      apartment: billingData.apartment || "1",
      city: billingData.city || "Cairo",
      state: billingData.state || "Cairo",
      country: billingData.country || "EGY",
      postal_code: billingData.postal_code || billingData.postalCode || "12345",
    };

    // Prepare items array
    const formattedItems =
      items && Array.isArray(items) && items.length > 0
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

    // If sandbox mode is configured with placeholder keys, return sandbox simulated response
    if (isTestMode() && (!secretKey || secretKey.includes("placeholder") || secretKey === "test_secret_key")) {
      const mockIntentionId = `test_int_${Date.now()}`;
      const mockOrderId = Math.floor(100000 + Math.random() * 900000);
      const mockClientSecret = `cs_test_${crypto.randomBytes(16).toString("hex")}`;
      const mockPaymentToken = `pk_test_${crypto.randomBytes(24).toString("hex")}`;

      return {
        id: mockIntentionId,
        intention_id: mockIntentionId,
        intention_order_id: mockOrderId,
        order_id: mockOrderId,
        client_secret: mockClientSecret,
        payment_token: mockPaymentToken,
        amount: amountInCents,
        currency: currency.toUpperCase(),
        payment_methods: methods,
        mode: "sandbox",
        test_cards: PAYMOB_TEST_CARDS,
      };
    }

    if (!secretKey) {
      throw new Error("PAYMOB_SECRET_KEY is not configured in environment variables.");
    }

    const response = await fetch(`${baseUrl}/v1/intention/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${secretKey}`,
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
 * Step 1: Paymob Authentication Request (Token Generation)
 * Authenticates with Paymob API using API key and returns authentication token.
 * 
 * @param {string} [apiKey] - Paymob API Key
 * @param {string} [baseUrl] - Paymob base URL
 * @returns {Promise<string>} Authentication token
 */
export const authenticate = async (
  apiKey = process.env.PAYMOB_API_KEY || PAYMOB_API_KEY,
  baseUrl = process.env.PAYMOB_BASE_URL || PAYMOB_BASE_URL
) => {
  if (isTestMode() && (!apiKey || apiKey.includes("placeholder"))) {
    return `mock_auth_token_${Date.now()}`;
  }

  const response = await fetch(`${baseUrl}/api/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });

  const data = await response.json();
  if (!response.ok || !data.token) {
    throw new Error(`Paymob Auth failed: ${data.message || response.statusText}`);
  }
  return data.token;
};

/**
 * Step 2: Paymob Order Registration Request
 * 
 * @param {Object} params
 * @param {string} params.authToken
 * @param {number} params.amountCents
 * @param {string} [params.currency='EGP']
 * @param {string} [params.merchantOrderId]
 * @param {Array<Object>} [params.items]
 * @param {string} [params.baseUrl]
 * @returns {Promise<Object>} Created order object containing order id
 */
export const createOrder = async ({
  authToken,
  amountCents,
  currency = PAYMOB_CURRENCY,
  merchantOrderId,
  items = [],
  baseUrl = process.env.PAYMOB_BASE_URL || PAYMOB_BASE_URL,
}) => {
  if (isTestMode() && (!authToken || authToken.includes("mock_auth_token"))) {
    return {
      id: Math.floor(100000 + Math.random() * 900000),
      amount_cents: amountCents,
      currency: currency.toUpperCase(),
      merchant_order_id: merchantOrderId,
    };
  }

  const response = await fetch(`${baseUrl}/api/ecommerce/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: "false",
      amount_cents: String(amountCents),
      currency: currency.toUpperCase(),
      merchant_order_id: merchantOrderId,
      items: items,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.id) {
    throw new Error(`Paymob Order Creation failed: ${data.message || response.statusText}`);
  }
  return data;
};

/**
 * Step 3: Paymob Payment Key Request (Generates payment key token for Iframe integration)
 * 
 * @param {Object} params
 * @param {string} params.authToken
 * @param {number} params.amountCents
 * @param {number|string} params.orderId
 * @param {string} [params.currency='EGP']
 * @param {number|string} [params.integrationId]
 * @param {Object} [params.billingData]
 * @param {string} [params.baseUrl]
 * @returns {Promise<string>} The payment key token
 */
export const generatePaymentKey = async ({
  authToken,
  amountCents,
  orderId,
  currency = PAYMOB_CURRENCY,
  integrationId = process.env.PAYMOB_INTEGRATION_ID || PAYMOB_INTEGRATION_ID,
  billingData = {},
  baseUrl = process.env.PAYMOB_BASE_URL || PAYMOB_BASE_URL,
}) => {
  if (isTestMode() && (!authToken || authToken.includes("mock_auth_token"))) {
    return `pk_test_${crypto.randomBytes(32).toString("hex")}`;
  }

  const formattedBillingData = {
    first_name: billingData.first_name || billingData.firstName || "Test",
    last_name: billingData.last_name || billingData.lastName || "Customer",
    phone_number: billingData.phone_number || billingData.phoneNumber || "+201000000000",
    email: billingData.email || "test.customer@example.com",
    street: billingData.street || "Test Street",
    building: billingData.building || "1",
    floor: billingData.floor || "1",
    apartment: billingData.apartment || "1",
    city: billingData.city || "Cairo",
    state: billingData.state || "Cairo",
    country: billingData.country || "EGY",
    postal_code: billingData.postal_code || billingData.postalCode || "12345",
  };

  const response = await fetch(`${baseUrl}/api/acceptance/payment_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: String(amountCents),
      expiration: 3600,
      order_id: String(orderId),
      billing_data: formattedBillingData,
      currency: currency.toUpperCase(),
      integration_id: Number(integrationId) || integrationId,
      lock_order_when_paid: "false",
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.token) {
    throw new Error(`Paymob Payment Key Generation failed: ${data.message || response.statusText}`);
  }
  return data.token;
};

/**
 * Creates a complete Iframe Payment Session (combining Auth, Order, and Payment Key generation).
 * 
 * @param {Object} params
 * @returns {Promise<Object>} { orderId, paymentToken, iframeUrl, iframeId, integrationId }
 */
export const createIframePaymentSession = async ({
  amount,
  currency = PAYMOB_CURRENCY,
  billingData = {},
  merchantOrderId,
  items = [],
  integrationId = process.env.PAYMOB_INTEGRATION_ID || PAYMOB_INTEGRATION_ID,
  iframeId = process.env.PAYMOB_IFRAME_ID || PAYMOB_IFRAME_ID,
}) => {
  const amountCents = Math.round(amount * 100);
  const authToken = await authenticate();
  const order = await createOrder({
    authToken,
    amountCents,
    currency,
    merchantOrderId,
    items,
  });

  const paymentToken = await generatePaymentKey({
    authToken,
    amountCents,
    orderId: order.id,
    currency,
    integrationId,
    billingData,
  });

  const iframeUrl = getIframeUrl(iframeId, paymentToken);

  return {
    orderId: order.id,
    paymentToken,
    iframeUrl,
    iframeId: iframeId || process.env.PAYMOB_IFRAME_ID,
    integrationId: integrationId || process.env.PAYMOB_INTEGRATION_ID,
  };
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
 * Calculates HMAC-SHA512 signature for a given Paymob transaction object (useful for testing and simulators).
 * 
 * @param {Object} obj - Transaction object
 * @param {string} [hmacSecret] - HMAC secret
 * @returns {string} Calculated hex digest
 */
export const calculateHmac = (
  obj,
  hmacSecret = process.env.PAYMOB_HMAC_SECRET || PAYMOB_HMAC_SECRET
) => {
  const formatValue = (val) => {
    if (val === undefined || val === null) return "";
    if (typeof val === "boolean") return val ? "true" : "false";
    return String(val);
  };

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

  return crypto
    .createHmac("sha512", hmacSecret)
    .update(concatenatedString)
    .digest("hex");
};

/**
 * Retrieves details of an existing transaction from Paymob.
 * 
 * @param {string|number} transactionId - The Paymob transaction ID
 * @param {string} [secretKey] - Paymob Secret key
 * @param {string} [baseUrl] - Paymob base URL
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
        Authorization: `Token ${secretKey}`,
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
  PAYMOB_BASE_URL,
  PAYMOB_TEST_CARDS,
  isTestMode,
  isTestCard,
  getPaymobTestCards,
  getIframeUrl,
  getUnifiedCheckoutUrl,
  createIntention,
  authenticate,
  createOrder,
  generatePaymentKey,
  createIframePaymentSession,
  verifyHmac,
  calculateHmac,
  retrieveTransaction,
};
