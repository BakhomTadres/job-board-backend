import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    token: {
      type: String,
    },
    role: {
      type: String,
      enum: ["job seeker", "employer", "admin"],
      default: "job seeker",
    },
    skills: {
      type: [String],
      default: [],
    },
    jobCredits: {
      type: Number,
      default: 0,
      min: [0, "Job credits cannot be negative"],
    },
    subscription: {
      plan: {
        type: String,
        enum: ["none", "starter", "featured", "weekly", "unlimited", "monthly", "admin"],
        default: "none",
      },
      expiresAt: {
        type: Date,
      },
      isActive: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);
