import mongoose from "mongoose";
import User from "../Models/userModel.js";
import Payment from "../Models/Payment.model.js";
import Job from "../Models/jobModel.js";
import { applyPaymentPlanToUser } from "../Controllers/payment.controller.js";
import { createJob } from "../Controllers/jobController.js";
import { checkJobPostingEligibility } from "../Controllers/userController.js";

console.log("====================================================");
console.log("Running Job Credits & Subscription Verification Tests");
console.log("====================================================\n");

let totalTests = 0;
let passedTests = 0;

const assert = (condition, name) => {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${name}`);
  }
};

const runTests = async () => {
  // --- Test Suite 1: UserModel Schema Defaults & Validation ---
  console.log("--- Test Suite 1: User Schema Defaults & Validation ---");
  const testEmployer = new User({
    name: "Employer Test",
    email: `employer_${Date.now()}@test.com`,
    password: "hashedpassword123",
    role: "employer",
  });

  assert(testEmployer.jobCredits === 0, "Default jobCredits is 0");
  assert(testEmployer.subscription?.plan === "none", "Default subscription.plan is 'none'");
  assert(testEmployer.subscription?.isActive === false, "Default subscription.isActive is false");

  // --- Test Suite 2: Eligibility Logic Verification ---
  console.log("\n--- Test Suite 2: Job Posting Eligibility Logic ---");
  const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.data = data;
      return res;
    };
    return res;
  };

  // 2a. Admin eligibility
  const adminReq = { user: { _id: new mongoose.Types.ObjectId(), role: "admin" } };
  const adminRes = mockRes();
  const originalFindById = User.findById;
  User.findById = (id) => ({
    ...testEmployer.toObject(),
    _id: id,
    role: "admin",
  });

  await checkJobPostingEligibility(adminReq, adminRes);
  assert(adminRes.data.canPost === true, "Admin canPost is true");
  assert(adminRes.data.jobCredits === 999999, "Admin jobCredits is unlimited (999999)");

  // 2b. Employer with 0 credits and no subscription
  User.findById = (id) => ({
    ...testEmployer.toObject(),
    _id: id,
    role: "employer",
    jobCredits: 0,
    subscription: { plan: "none", isActive: false },
  });
  const empReq = { user: { _id: new mongoose.Types.ObjectId(), role: "employer" } };
  const empRes = mockRes();
  await checkJobPostingEligibility(empReq, empRes);
  assert(empRes.data.canPost === false, "Unpaid employer canPost is false");
  assert(empRes.data.jobCredits === 0, "Employer credits is 0");

  // 2c. Employer with 2 credits
  User.findById = (id) => ({
    ...testEmployer.toObject(),
    _id: id,
    role: "employer",
    jobCredits: 2,
    subscription: { plan: "starter", isActive: false },
  });
  const empCreditsRes = mockRes();
  await checkJobPostingEligibility(empReq, empCreditsRes);
  assert(empCreditsRes.data.canPost === true, "Employer with 2 credits canPost is true");
  assert(empCreditsRes.data.jobCredits === 2, "Employer returns 2 credits");

  // 2d. Employer with active unlimited subscription
  User.findById = (id) => ({
    ...testEmployer.toObject(),
    _id: id,
    role: "employer",
    jobCredits: 0,
    subscription: { plan: "unlimited", isActive: true, expiresAt: new Date(Date.now() + 86400000) },
  });
  const empSubRes = mockRes();
  await checkJobPostingEligibility(empReq, empSubRes);
  assert(empSubRes.data.canPost === true, "Subscribed employer canPost is true");
  assert(empSubRes.data.isSubscribed === true, "isSubscribed is true");

  // --- Test Suite 3: Job Posting Restrictions & 402 Error in createJob ---
  console.log("\n--- Test Suite 3: Job Posting Enforcement (402 Payment Required) ---");
  // 3a. 0 credits employer rejected with 402
  User.findById = (id) => ({
    ...testEmployer.toObject(),
    _id: id,
    role: "employer",
    jobCredits: 0,
    subscription: { plan: "none", isActive: false },
  });
  const postReq = {
    user: { _id: new mongoose.Types.ObjectId(), role: "employer" },
    body: { title: "Frontend Engineer", companyName: "Tech Inc", description: "Need Angular dev", location: "Remote" },
  };
  const postRes = mockRes();
  await createJob(postReq, postRes);
  assert(postRes.statusCode === 402, "Rejects unpaid posting with HTTP 402");
  assert(postRes.data.paymentRequired === true, "Returns paymentRequired: true");
  assert(postRes.data.message.includes("Payment required"), "Returns informative message");

  // 3b. Credited employer succeeds and credit is decremented
  let savedUser = null;
  const creditedUserObj = {
    ...testEmployer.toObject(),
    _id: new mongoose.Types.ObjectId(),
    role: "employer",
    jobCredits: 1,
    subscription: { plan: "starter", isActive: false },
    save: async function () {
      savedUser = this;
      return this;
    },
  };
  User.findById = () => creditedUserObj;

  const originalJobCreate = Job.create;
  Job.create = async (doc) => ({ ...doc, _id: new mongoose.Types.ObjectId() });

  const postSuccessRes = mockRes();
  await createJob(postReq, postSuccessRes);
  assert(postSuccessRes.statusCode === 201, "Allowed posting with credits (HTTP 201)");
  assert(creditedUserObj.jobCredits === 0, "Decremented jobCredits from 1 to 0");
  assert(postSuccessRes.data.remainingCredits === 0, "Response indicates remainingCredits: 0");

  // 3c. Subscribed employer succeeds WITHOUT decrementing credits
  const subscribedUserObj = {
    ...testEmployer.toObject(),
    _id: new mongoose.Types.ObjectId(),
    role: "employer",
    jobCredits: 3,
    subscription: { plan: "unlimited", isActive: true, expiresAt: new Date(Date.now() + 86400000) },
    save: async function () {
      savedUser = this;
      return this;
    },
  };
  User.findById = () => subscribedUserObj;
  const postSubRes = mockRes();
  await createJob(postReq, postSubRes);
  assert(postSubRes.statusCode === 201, "Subscribed employer posts successfully (HTTP 201)");
  assert(subscribedUserObj.jobCredits === 3, "Did NOT decrement job credits for unlimited subscriber");

  // Restore mocks
  User.findById = originalFindById;
  Job.create = originalJobCreate;

  // --- Test Suite 4: Plan Activation & Credit Addition in applyPaymentPlanToUser ---
  console.log("\n--- Test Suite 4: applyPaymentPlanToUser Logic & Idempotency ---");
  let userRecord = {
    _id: new mongoose.Types.ObjectId(),
    jobCredits: 0,
    subscription: { plan: "none", isActive: false },
    save: async function () {
      return this;
    },
  };

  User.findById = async () => userRecord;

  // 4a. Single job payment adds +1 credit
  const singlePayment = {
    _id: new mongoose.Types.ObjectId(),
    userId: userRecord._id,
    planId: "starter",
    isProcessed: false,
    save: async function () {
      return this;
    },
  };

  await applyPaymentPlanToUser(singlePayment);
  assert(userRecord.jobCredits === 1, "Adds +1 credit for single job (starter) payment");
  assert(singlePayment.isProcessed === true, "Marks payment as isProcessed = true");

  // 4b. Idempotency test (calling again does NOT add another credit)
  await applyPaymentPlanToUser(singlePayment);
  assert(userRecord.jobCredits === 1, "Idempotent: does NOT add duplicate credit on retry");

  // 4c. Weekly plan activates 7-day subscription
  const weeklyPayment = {
    _id: new mongoose.Types.ObjectId(),
    userId: userRecord._id,
    planId: "weekly",
    isProcessed: false,
    save: async function () {
      return this;
    },
  };

  await applyPaymentPlanToUser(weeklyPayment);
  assert(userRecord.subscription.isActive === true, "Activates weekly subscription");
  assert(userRecord.subscription.plan === "weekly", "Sets subscription plan to 'weekly'");
  const weeklyDaysDiff = (new Date(userRecord.subscription.expiresAt).getTime() - Date.now()) / (1000 * 3600 * 24);
  assert(weeklyDaysDiff >= 6.8 && weeklyDaysDiff <= 7.2, "Sets expiration to ~7 days in the future for weekly plan");

  // 4d. Unlimited plan activates 30-day subscription
  userRecord.subscription.expiresAt = null; // reset for fresh calculation test
  const unlimitedPayment = {
    _id: new mongoose.Types.ObjectId(),
    userId: userRecord._id,
    planId: "unlimited",
    isProcessed: false,
    save: async function () {
      return this;
    },
  };

  await applyPaymentPlanToUser(unlimitedPayment);
  assert(userRecord.subscription.isActive === true, "Activates unlimited subscription");
  assert(userRecord.subscription.plan === "unlimited", "Sets subscription plan to 'unlimited'");
  const daysDiff = (new Date(userRecord.subscription.expiresAt).getTime() - Date.now()) / (1000 * 3600 * 24);
  assert(daysDiff >= 29 && daysDiff <= 31, "Sets expiration to ~30 days in the future");

  console.log(`\n====================================================`);
  console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
  console.log(`====================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
