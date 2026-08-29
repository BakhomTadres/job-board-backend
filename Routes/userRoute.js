import { Router } from "express";
import { 
  registerUser, 
  loginUser, 
  getProfile, 
  updateProfile, 
  getUserById, 
  logoutUser
} from "../Controllers/userController.js";
import { authenticateUser } from "../Middlewares/auth.js";

const userRouter = Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/logout", authenticateUser, logoutUser);
userRouter.get("/profile", authenticateUser, getProfile);
userRouter.patch("/profile", authenticateUser, updateProfile); 
userRouter.get("/:id", authenticateUser, getUserById);

export default userRouter;