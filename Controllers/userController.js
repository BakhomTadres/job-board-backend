import User from "../Models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res) => {
  const { name, email, password, passwordConfirm, role } = req.body;

  try {
    if (password !== passwordConfirm) {
      return res.status(400).json({
        status: "fail",
        message: "Passwords do not match",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        status: "fail",
        message: "Password must be at least 6 characters long",
      });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: "fail",
        message: "User with that email already exists",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const token = jwt.sign({ email }, process.env.JWT_SECRET);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      token,
    });

    res.status(201).json({
      status: "success",
      user,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET);
    user.token = token;
    await user.save();
    
    res.status(200).json({
      status: "success",
      token: user.token,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const { email } = req.user;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        status: "fail",
        message: "User not found",
      });
    }
    user.token = null;
    await user.save();
    res.status(200).json({
      status: "success",
      user,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const { email } = req.user;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        status: "fail",
        message: "User not found",
      });
    }
    res.status(200).json({
      status: "success",
      user,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { email } = req.user;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        status: "fail",
        message: "User not found",
      });
    }
    const { name, newEmail, password, passwordConfirm } = req.body;
    if (name) user.name = name;
    if (newEmail) {
      user.email = newEmail;
      const newToken = jwt.sign({ email: newEmail }, process.env.JWT_SECRET);
      user.token = newToken;
    }
    if (password) {
      if (password !== passwordConfirm) {
        return res.status(400).json({
          status: "fail",
          message: "Passwords do not match",
        });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      user.password = hashedPassword;
    }
    await user.save();
    res.status(200).json({
      status: "success",
      user,
      token: user.token
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(400).json({
        status: "fail",
        message: "User not found",
      });
    }
    res.status(200).json({
      status: "success",
      user,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
};
