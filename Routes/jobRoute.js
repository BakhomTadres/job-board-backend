import { Router } from "express";
import { createJob, getAllJobs } from "../Controllers/jobController.js";
import { authenticateUser } from "../Middlewares/auth.js";
const jobRouter = Router();

jobRouter.post("/", authenticateUser, createJob);
jobRouter.get("/",getAllJobs);


export default jobRouter;