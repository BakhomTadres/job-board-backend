import { Router } from "express";
import { createJob, getAllJobs, getjobbyid,updatejob, deletejob } from "../Controllers/jobController.js";
import { authenticateUser , roleMiddleware} from "../Middlewares/auth.js";
const jobRouter = Router();

jobRouter.post("/", authenticateUser, roleMiddleware("employer", "admin"),createJob);
jobRouter.get("/",getAllJobs);
jobRouter.get("/",  getjobbyid);
jobRouter.put("/",updatejob );
jobRouter.delete("/",deletejob);

export default jobRouter;