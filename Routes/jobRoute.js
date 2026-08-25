import { Router } from "express";
import { createJob, getAllJobs } from "../Controllers/jobController.js";

const jobRouter = Router();

jobRouter.post("/", createJob);
jobRouter.get("/", getAllJobs);


export default jobRouter;