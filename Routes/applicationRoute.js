import express from "express";
import {
        applyForJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus
} 
from "../Controllers/applicationController.js";

const router = express.Router();

router.post("/jobs/:id/apply",applyForJob);

router.get("/applications/user/:id", getMyApplications);

router.get("/jobs/:id/applications",getJobApplications);

router.patch("/applications/:id",updateApplicationStatus);

export default router;
