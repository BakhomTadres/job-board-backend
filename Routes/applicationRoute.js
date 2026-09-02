import express from "express";
import {
    applyForJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus,
    getAllApplications
} from "../Controllers/applicationController.js";
import { authenticateUser, roleMiddleware } from "../Middlewares/auth.js"; // ضفنا الـ roleMiddleware

const router = express.Router();

router.get("/applications", authenticateUser, roleMiddleware("admin"), getAllApplications);

router.post("/jobs/:id/apply", authenticateUser, roleMiddleware("job seeker"), applyForJob);

router.get("/applications/user/:id", authenticateUser, roleMiddleware("job seeker" ,"admin"), getMyApplications);

router.get("/jobs/:jobId/applications", authenticateUser, roleMiddleware("employer", "admin"), getJobApplications);

router.patch("/applications/:id", authenticateUser, roleMiddleware("employer","admin"), updateApplicationStatus);

export default router;