import jwt from "jsonwebtoken";
import User from "../Models/userModel.js";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";

export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ status: "fail", message: "Token is required" });
    }
    const token = authHeader.split(" ")[1];
    
    // فك التوكن باستخدام نفس المفتاح الاحتياطي
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findOne({ email: decoded.email });
    
    if (!user) {
      return res.status(401).json({ status: "fail", message: "User not found" });
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ status: "fail", message: "Invalid token" });
  }
};

export const roleMiddleware = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "You do not have permission to perform this action"
            });
        }
        next(); 
    };
};