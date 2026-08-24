import jwt from "jsonwebtoken";
import User from "../Models/userModel.js";

export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ status: "fail", message: "Token is required" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ email: decoded.email });
    if (!user || user.token !== token) {
      return res.status(401).json({ status: "fail", message: "Invalid or expired session" });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ status: "fail", message: "Invalid token" });
  }
};