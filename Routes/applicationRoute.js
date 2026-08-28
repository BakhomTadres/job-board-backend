import express from "express";
import {
    applyForJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus
} from "../Controllers/applicationController.js";
import { authenticateUser, roleMiddleware } from "../Middlewares/auth.js"; // ضفنا الـ roleMiddleware

const router = express.Router();

router.post("/jobs/:id/apply", authenticateUser, roleMiddleware("job seeker"), applyForJob);

router.get("/applications/user/:id", authenticateUser, roleMiddleware("job seeker" ,"admin"), getMyApplications);

router.get("/jobs/:jobId/applications", authenticateUser, roleMiddleware("employer", "admin"), getJobApplications);

router.patch("/applications/:id", authenticateUser, roleMiddleware("employer"), updateApplicationStatus);

export default router;