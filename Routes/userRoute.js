import { Router } from "express";
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  getUserById,
  logoutUser,
  checkJobPostingEligibility,
  getAllUsers
} from "../Controllers/userController.js";
import { authenticateUser, roleMiddleware } from "../Middlewares/auth.js";

const userRouter = Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/logout", authenticateUser, logoutUser);
userRouter.get("/", authenticateUser, roleMiddleware("admin"), getAllUsers);
// Place specific named routes BEFORE dynamic /:id route/
userRouter.get("/job-posting-eligibility", authenticateUser, checkJobPostingEligibility);
userRouter.get("/profile", authenticateUser, getProfile);
userRouter.patch("/profile", authenticateUser, updateProfile);
userRouter.get("/:id", authenticateUser, getUserById);

export default userRouter;
