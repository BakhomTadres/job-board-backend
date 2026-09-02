import crypto from "crypto";
import {
  verifyHmac,
  calculateHmac,
  getUnifiedCheckoutUrl,
  getIframeUrl,
  isTestMode,
  isTestCard,
  getPaymobTestCards,
  createIntention,
  createIframePaymentSession,
  PAYMOB_TEST_CARDS,
} from "../Services/paymob.gateway.js";

/**
 * Paymob Sandbox & Testing Verification Test Suite
 */
console.log("==================================================");
console.log("Running Paymob Sandbox & Integration Test Suite");
console.log("==================================================\n");

let passedTests = 0;
let totalTests = 0;

const assert = (condition, testName) => {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
  }
};

const runAsyncTests = async () => {
  // --- Test Suite 1: Sandbox & Testing Environment Mode ---
  console.log("--- Test Suite 1: Sandbox Environment Detection ---");
  assert(isTestMode() === true, "Identifies environment as Sandbox/Testing mode");

  // --- Test Suite 2: Test Card Detection & Helpers ---
  console.log("\n--- Test Suite 2: Paymob Default Test Cards ---");
  const testCards = getPaymobTestCards();
  assert(Array.isArray(testCards) && testCards.length >= 2, "Provides list of default Paymob test cards");
  assert(testCards[0].cardNumber === "4000000000000002", "Contains primary Visa test card (4000 0000 0000 0002)");
  assert(testCards[1].cardNumber === "1111111111111111", "Contains secondary MasterCard test card (1111 1111 1111 1111)");

  assert(isTestCard("4000 0000 0000 0002") === true, "Validates spaced Visa test card: 4000 0000 0000 0002");
  assert(isTestCard("4000000000000002") === true, "Validates unspaced Visa test card: 4000000000000002");
  assert(isTestCard("1111 1111 1111 1111") === true, "Validates spaced MasterCard test card: 1111 1111 1111 1111");
  assert(isTestCard("1111111111111111") === true, "Validates unspaced MasterCard test card: 1111111111111111");
  assert(isTestCard("4111111111111111") === false, "Rejects non-Paymob test card numbers");

  // --- Test Suite 3: Unified Checkout & Iframe URL Generation ---
  console.log("\n--- Test Suite 3: Checkout and Iframe URL Generation ---");
  const testPublicKey = "egy_pk_test_123456789";
  const testClientSecret = "cs_test_987654321";
  const expectedCheckoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${testPublicKey}&clientSecret=${testClientSecret}`;
  const actualCheckoutUrl = getUnifiedCheckoutUrl(testClientSecret, testPublicKey, "https://accept.paymob.com");
  assert(actualCheckoutUrl === expectedCheckoutUrl, "Generates exact Paymob Unified Checkout redirect URL");

  const testIframeId = "789123";
  const testPaymentToken = "pk_test_token_abc_xyz";
  const expectedIframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${testIframeId}?payment_token=${testPaymentToken}`;
  const actualIframeUrl = getIframeUrl(testIframeId, testPaymentToken, "https://accept.paymob.com");
  assert(actualIframeUrl === expectedIframeUrl, "Generates exact Paymob Classic Iframe URL with test Iframe ID");

  // --- Test Suite 4: Sandbox Intention Creation ---
  console.log("\n--- Test Suite 4: Sandbox Intention Creation ---");
  const intentionResponse = await createIntention({
    amount: 150.5,
    currency: "EGP",
    billingData: {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      phoneNumber: "+201000000000",
    },
    specialReference: "ORDER-TEST-1788305420909",
  });

  assert(intentionResponse && typeof intentionResponse.client_secret === "string", "Creates sandbox intention with client_secret");
  assert(intentionResponse.amount === 15050, "Converts amount to cents correctly (150.50 -> 15050)");
  assert(intentionResponse.mode === "sandbox", "Marks response as sandbox mode");

  // --- Test Suite 5: Sandbox 3-Step Iframe Session ---
  console.log("\n--- Test Suite 5: 3-Step Iframe Session Creation ---");
  const iframeSession = await createIframePaymentSession({
    amount: 200,
    currency: "EGP",
    merchantOrderId: "ORDER-IFRAME-1788305420909",
    iframeId: "789123",
    integrationId: "456789",
  });

  assert(Boolean(iframeSession.paymentToken), "Generates paymentToken for Iframe session");
  assert(iframeSession.iframeUrl.includes("789123"), "Includes configured Iframe ID in Iframe URL");
  assert(iframeSession.iframeUrl.includes(iframeSession.paymentToken), "Includes payment token in Iframe URL");

  // --- Test Suite 6: HMAC-SHA512 Webhook Verification & Calculation ---
  console.log("\n--- Test Suite 6: HMAC-SHA512 Webhook Verification ---");
  const testHmacSecret = "TEST_HMAC_SECRET_999";

  const mockTransaction = {
    amount_cents: 10000,
    created_at: "2026-08-29T12:00:00.000000",
    currency: "EGP",
    error_occured: false,
    has_parent_transaction: false,
    id: 12345678,
    integration_id: 456789,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: {
      id: 554433,
    },
    owner: 1122,
    pending: false,
    source_data: {
      pan: "0002",
      sub_type: "Visa",
      type: "card",
    },
    success: true,
  };

  const computedHmac = calculateHmac(mockTransaction, testHmacSecret);
  const isValid = verifyHmac(mockTransaction, computedHmac, testHmacSecret);
  assert(isValid === true, "Validates authentic webhook payload against calculated HMAC-SHA512 signature");

  // Test tampered payload detection (e.g. modified amount)
  const tamperedTransaction = { ...mockTransaction, amount_cents: 20000 };
  const isTamperedValid = verifyHmac(tamperedTransaction, computedHmac, testHmacSecret);
  assert(isTamperedValid === false, "Rejects tampered transaction payload (modified amount_cents)");

  // Test tampered status detection (e.g. success manipulated)
  const fakeSuccessTransaction = { ...mockTransaction, success: false };
  const isFakeSuccessValid = verifyHmac(fakeSuccessTransaction, computedHmac, testHmacSecret);
  assert(isFakeSuccessValid === false, "Rejects tampered transaction payload (modified success boolean)");

  // Test invalid/wrong HMAC secret
  const isWrongSecretValid = verifyHmac(mockTransaction, computedHmac, "WRONG_SECRET");
  assert(isWrongSecretValid === false, "Rejects payload when HMAC secret does not match");

  // --- Test Suite 7: Payment Status Mapping Logic ---
  console.log("\n--- Test Suite 7: Payment Status Mapping ---");
  const resolveStatus = (tx) => {
    const isSuccess = tx.success === true || tx.success === "true" || tx.success === 1;
    const isPending = tx.pending === true || tx.pending === "true" || tx.pending === 1;
    const isVoided = tx.is_voided === true || tx.is_voided === "true";
    const isRefunded = tx.is_refunded === true || tx.is_refunded === "true";

    if (isVoided || isRefunded) return "canceled";
    if (isSuccess && !isPending) return "succeeded";
    if (!isSuccess && !isPending) return "failed";
    return "pending";
  };

  assert(resolveStatus({ success: true, pending: false }) === "succeeded", "Maps successful transaction to 'succeeded'");
  assert(resolveStatus({ success: false, pending: false }) === "failed", "Maps failed transaction to 'failed'");
  assert(resolveStatus({ success: false, pending: true }) === "pending", "Maps pending transaction to 'pending'");
  assert(resolveStatus({ is_voided: true, success: true }) === "canceled", "Maps voided transaction to 'canceled'");
  assert(resolveStatus({ is_refunded: true, success: true }) === "canceled", "Maps refunded transaction to 'canceled'");

  console.log(`\n==================================================`);
  console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
  console.log(`==================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
};

runAsyncTests().catch((err) => {
  console.error("Test Suite Unhandled Exception:", err);
  process.exit(1);
});
