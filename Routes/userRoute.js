import { Router } from "express";
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  getUserById,
  logoutUser,
  checkJobPostingEligibility,
} from "../Controllers/userController.js";
import { authenticateUser } from "../Middlewares/auth.js";

const userRouter = Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/logout", authenticateUser, logoutUser);

// Place specific named routes BEFORE dynamic /:id route
userRouter.get("/job-posting-eligibility", authenticateUser, checkJobPostingEligibility);
userRouter.get("/profile", authenticateUser, getProfile);
userRouter.patch("/profile", authenticateUser, updateProfile);
userRouter.get("/:id", authenticateUser, getUserById);

export default userRouter;
