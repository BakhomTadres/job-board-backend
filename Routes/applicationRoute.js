import express from "express";
import {
    applyForJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus
} from "../Controllers/applicationController.js";
import { authenticateUser } from "../Middlewares/auth.js";

const router = express.Router();

router.post("/jobs/:id/apply", applyForJob);

router.get("/applications/user/:id", getMyApplications);

router.get("/jobs/:jobId/applications", authenticateUser, getJobApplications);

router.patch("/applications/:id", updateApplicationStatus);

export default router;