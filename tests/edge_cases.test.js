import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { calculateMatchScore } from "../Services/matchScore.service.js";
import { updateJob, deleteJob } from "../Controllers/jobController.js";
import { applyForJob } from "../Controllers/applicationController.js";
import { registerUser, loginUser } from "../Controllers/userController.js";
import Job from "../Models/jobModel.js";
import Application from "../Models/applicationModel.js";
import User from "../Models/userModel.js";

console.log("==================================================");
console.log("Running Comprehensive Edge Cases Test Suite");
console.log("==================================================\n");

let passed = 0;
let total = 0;

const assert = (condition, testName, details = "") => {
  total++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName} ${details ? `(${details})` : ""}`);
  }
};

// Mock Response Helper
const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

// ==========================================
// 1. MatchScore Service Edge Cases
// ==========================================
console.log("--- 1. Match Score Service Edge Cases ---");
assert(calculateMatchScore([], ["React", "Node.js"]) === 0, "Empty user skills returns 0%");
assert(calculateMatchScore(["React"], []) === 0, "Empty job skills returns 0%");
assert(calculateMatchScore(null, undefined) === 0, "Null/undefined inputs return 0% without crashing");
assert(
  calculateMatchScore(["  NODE.js  ", "rEaCt"], ["node.js", "react", "mongo"]) === 67,
  "Case-insensitivity, trimming, and rounding calculation (2/3 = 67%)"
);
assert(
  calculateMatchScore(["Python", "Django"], ["Node.js", "Express"]) === 0,
  "Completely disjoint skills return 0%"
);

// ==========================================
// 2. JWT & Auth Token Edge Cases
// ==========================================
console.log("\n--- 2. JWT Token Expiration & Payload Edge Cases ---");
const testSecret = process.env.JWT_SECRET || "fallback_secret_key";
const testPayload = { id: "660000000000000000000001", email: "candidate@test.com", role: "job seeker" };
const token = jwt.sign(testPayload, testSecret, { expiresIn: "7d" });
const decoded = jwt.verify(token, testSecret);

assert(decoded.id === testPayload.id, "Token payload retains user id");
assert(decoded.email === testPayload.email, "Token payload retains user email");
assert(decoded.role === testPayload.role, "Token payload retains user role");
assert(decoded.exp - decoded.iat === 7 * 24 * 60 * 60, "Token expiry is exactly 7 days");

// ==========================================
// 3. Job Ownership & Modification Edge Cases
// ==========================================
console.log("\n--- 3. Job Ownership (IDOR / BOLA Prevention) Edge Cases ---");

const employerA_Id = new mongoose.Types.ObjectId();
const employerB_Id = new mongoose.Types.ObjectId();
const admin_Id = new mongoose.Types.ObjectId();
const sampleJobId = new mongoose.Types.ObjectId();

// Mock Job.findById & findByIdAndUpdate
const originalJobFindById = Job.findById;
const originalJobFindByIdAndUpdate = Job.findByIdAndUpdate;
const originalJobFindByIdAndDelete = Job.findByIdAndDelete;

Job.findById = async (id) => {
  if (id.toString() === sampleJobId.toString()) {
    return {
      _id: sampleJobId,
      title: "Backend Engineer",
      employer: employerA_Id,
    };
  }
  return null;
};
Job.findByIdAndUpdate = async (id, body) => ({ _id: id, ...body, employer: employerA_Id });
Job.findByIdAndDelete = async (id) => ({ _id: id });

// Edge Case 3.1: Employer A updating their own job -> 200 OK
{
  const req = {
    params: { id: sampleJobId.toString() },
    user: { _id: employerA_Id, role: "employer" },
    body: { title: "Updated Title" },
  };
  const res = createMockRes();
  await updateJob(req, res);
  assert(res.statusCode === 200, "Employer updating their own job is ALLOWED (200 OK)");
}

// Edge Case 3.2: Employer B updating Employer A's job -> 403 Forbidden
{
  const req = {
    params: { id: sampleJobId.toString() },
    user: { _id: employerB_Id, role: "employer" },
    body: { title: "Hacked Title" },
  };
  const res = createMockRes();
  await updateJob(req, res);
  assert(res.statusCode === 403, "Employer modifying someone else's job is REJECTED (403 Forbidden)");
}

// Edge Case 3.3: Admin updating any job -> 200 OK
{
  const req = {
    params: { id: sampleJobId.toString() },
    user: { _id: admin_Id, role: "admin" },
    body: { title: "Admin Updated Title" },
  };
  const res = createMockRes();
  await updateJob(req, res);
  assert(res.statusCode === 200, "Admin modifying any job is ALLOWED (200 OK)");
}

// Edge Case 3.4: Updating non-existent job -> 404 Not Found
{
  const req = {
    params: { id: new mongoose.Types.ObjectId().toString() },
    user: { _id: employerA_Id, role: "employer" },
    body: { title: "Title" },
  };
  const res = createMockRes();
  await updateJob(req, res);
  assert(res.statusCode === 404, "Updating non-existent job returns 404 Not Found");
}

// Edge Case 3.5: Employer B deleting Employer A's job -> 403 Forbidden
{
  const req = {
    params: { id: sampleJobId.toString() },
    user: { _id: employerB_Id, role: "employer" },
  };
  const res = createMockRes();
  await deleteJob(req, res);
  assert(res.statusCode === 403, "Employer deleting someone else's job is REJECTED (403 Forbidden)");
}

// Edge Case 3.6: Employer A deleting their own job -> 200 OK
{
  const req = {
    params: { id: sampleJobId.toString() },
    user: { _id: employerA_Id, role: "employer" },
  };
  const res = createMockRes();
  await deleteJob(req, res);
  assert(res.statusCode === 200, "Employer deleting their own job is ALLOWED (200 OK)");
}

// Edge Case 3.7: Deleting non-existent job -> 404 Not Found (Confirm ASI return bug is fixed)
{
  const req = {
    params: { id: new mongoose.Types.ObjectId().toString() },
    user: { _id: employerA_Id, role: "employer" },
  };
  const res = createMockRes();
  await deleteJob(req, res);
  assert(res.statusCode === 404, "Deleting non-existent job returns 404 (ASI return bug fixed)");
}

// ==========================================
// 4. Job Application & Duplicate Check Edge Cases
// ==========================================
console.log("\n--- 4. Job Application & Duplicate Prevention Edge Cases ---");

const originalUserFindById = User.findById;
const originalAppFindOne = Application.findOne;
const originalAppCreate = Application.create;

const applicantId = new mongoose.Types.ObjectId();

User.findById = async (id) => {
  if (id.toString() === applicantId.toString()) {
    return { _id: applicantId, name: "Candidate Name", skills: ["Node.js", "React"] };
  }
  return null;
};

// Edge Case 4.1: First-time application -> 201 Created
{
  Application.findOne = async () => null; // No duplicate
  Application.create = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const req = {
    params: { id: sampleJobId.toString() },
    user: { _id: applicantId },
    body: { cv: "https://example.com/cv.pdf" },
  };
  const res = createMockRes();
  await applyForJob(req, res);
  assert(res.statusCode === 201, "First time job application is accepted (201 Created)");
}

// Edge Case 4.2: Duplicate application for same job -> 400 Bad Request
{
  Application.findOne = async ({ jobId, userId }) => {
    if (jobId.toString() === sampleJobId.toString() && userId.toString() === applicantId.toString()) {
      return { _id: new mongoose.Types.ObjectId(), jobId, userId };
    }
    return null;
  };

  const req = {
    params: { id: sampleJobId.toString() },
    user: { _id: applicantId },
    body: { cv: "https://example.com/cv.pdf" },
  };
  const res = createMockRes();
  await applyForJob(req, res);
  assert(res.statusCode === 400, "Duplicate application for the same job is REJECTED (400 Bad Request)");
}

// Edge Case 4.3: Applying for non-existent job -> 404 Not Found
{
  const req = {
    params: { id: new mongoose.Types.ObjectId().toString() },
    user: { _id: applicantId },
    body: { cv: "https://example.com/cv.pdf" },
  };
  const res = createMockRes();
  await applyForJob(req, res);
  assert(res.statusCode === 404, "Applying for non-existent job returns 404 Not Found");
}

// ==========================================
// 5. User Registration Validation Edge Cases
// ==========================================
console.log("\n--- 5. User Registration Validation Edge Cases ---");

const originalUserFindOne = User.findOne;
const originalUserCreate = User.create;

// Edge Case 5.1: Passwords do not match -> 400
{
  const req = {
    body: {
      name: "Ahmed",
      email: "ahmed@test.com",
      password: "password123",
      passwordConfirm: "differentPassword",
    },
  };
  const res = createMockRes();
  await registerUser(req, res);
  assert(res.statusCode === 400, "Password confirmation mismatch returns 400");
}

// Edge Case 5.2: Short password (<6 chars) -> 400
{
  const req = {
    body: {
      name: "Ahmed",
      email: "ahmed@test.com",
      password: "123",
      passwordConfirm: "123",
    },
  };
  const res = createMockRes();
  await registerUser(req, res);
  assert(res.statusCode === 400, "Short password (< 6 characters) returns 400");
}

// Edge Case 5.3: Duplicate Email Registration -> 400
{
  User.findOne = async ({ email }) => (email === "existing@test.com" ? { _id: "1", email } : null);
  const req = {
    body: {
      name: "Ahmed",
      email: "existing@test.com",
      password: "password123",
      passwordConfirm: "password123",
    },
  };
  const res = createMockRes();
  await registerUser(req, res);
  assert(res.statusCode === 400, "Registration with already registered email returns 400");
}

// Restore Mongoose Mocks
Job.findById = originalJobFindById;
Job.findByIdAndUpdate = originalJobFindByIdAndUpdate;
Job.findByIdAndDelete = originalJobFindByIdAndDelete;
User.findById = originalUserFindById;
User.findOne = originalUserFindOne;
User.create = originalUserCreate;
Application.findOne = originalAppFindOne;
Application.create = originalAppCreate;

console.log("\n==================================================");
console.log(`Summary: ${passed}/${total} Edge Case Tests Passed.`);
console.log("==================================================");

if (passed !== total) {
  process.exit(1);
}
