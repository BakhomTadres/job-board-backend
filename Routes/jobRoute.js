import { Router } from "express";
import { createJob, getAllJobs } from "../Controllers/jobController.js";
import { authenticateUser , roleMiddleware} from "../Middlewares/auth.js";
const jobRouter = Router();

jobRouter.post("/", authenticateUser, roleMiddleware("employer", "admin"),createJob);
jobRouter.get("/",getAllJobs);


export default jobRouter;