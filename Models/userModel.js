import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  token: {
    type: String,
  },
  role: {
    type: String,
    enum: ["job seeker","employer","admin"],
    default: "job seeker"
  },
  skills: {
    type : [String],
    default : []
  }
});


export default mongoose.model("User", userSchema);