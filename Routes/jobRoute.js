import { Router } from "express";
import { createJob, getAllJobs, getJobById, updateJob, deleteJob ,getRecommendedJobs, getJobStats } from "../Controllers/jobController.js";
import { authenticateUser, roleMiddleware } from "../Middlewares/auth.js";

const jobRouter = Router();

jobRouter.post("/", authenticateUser, roleMiddleware("employer", "admin"), createJob);
jobRouter.get("/", getAllJobs);
jobRouter.get('/recommended', authenticateUser, getRecommendedJobs);
jobRouter.get('/stats', getJobStats)
jobRouter.get("/:id", getJobById);
jobRouter.put("/:id", authenticateUser, roleMiddleware("employer", "admin"), updateJob);
jobRouter.delete("/:id", authenticateUser, roleMiddleware("employer", "admin"), deleteJob);

export default jobRouter;