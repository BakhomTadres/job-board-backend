import crypto from "crypto";
import { verifyHmac, getUnifiedCheckoutUrl } from "../Services/paymob.gateway.js";

/**
 * Paymob Integration Verification Test Suite
 */
console.log("==================================================");
console.log("Running Paymob Integration Unit & Verification Tests");
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

// --- Test 1: Unified Checkout URL Generation ---
console.log("--- Test Suite: Unified Checkout URL ---");
const testPublicKey = "egy_pk_test_123456789";
const testClientSecret = "cs_test_987654321";
const expectedUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${testPublicKey}&clientSecret=${testClientSecret}`;
const actualUrl = getUnifiedCheckoutUrl(testClientSecret, testPublicKey, "https://accept.paymob.com");

assert(actualUrl === expectedUrl, "Generates exact Paymob Unified Checkout redirect URL");

// --- Test 2: Paymob HMAC SHA-512 Calculation & Verification ---
console.log("\n--- Test Suite: HMAC-SHA512 Webhook Verification ---");
const testHmacSecret = "TEST_HMAC_SECRET_999";

const mockTransaction = {
  amount_cents: 10000,
  created_at: "2026-08-29T12:00:00.000000",
  currency: "EGP",
  error_occured: false,
  has_parent_transaction: false,
  id: 12345678,
  integration_id: 998877,
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
    pan: "2345",
    sub_type: "MasterCard",
    type: "card",
  },
  success: true,
};

// Calculate expected HMAC string concatenation
const concatenated = [
  "10000",
  "2026-08-29T12:00:00.000000",
  "EGP",
  "false",
  "false",
  "12345678",
  "998877",
  "true",
  "false",
  "false",
  "false",
  "true",
  "false",
  "554433",
  "1122",
  "false",
  "2345",
  "MasterCard",
  "card",
  "true",
].join("");

const computedHmac = crypto
  .createHmac("sha512", testHmacSecret)
  .update(concatenated)
  .digest("hex");

// Test valid HMAC verification
const isValid = verifyHmac(mockTransaction, computedHmac, testHmacSecret);
assert(isValid === true, "Validates authentic webhook payload against HMAC-SHA512 signature");

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

// --- Test 3: Status Resolution Logic ---
console.log("\n--- Test Suite: Payment Status Mapping ---");

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
