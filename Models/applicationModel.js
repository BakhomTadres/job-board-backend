import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
    jobTitle: {
        type: String,
        required: [true, "Job Title is required"], 
        minlength: 3,
    },
    applicantName: {
        type: String,
        required: [true, "Application Name is required"],
        minlength: 3,
    },
    cv: {
        type: String,
        required: [true, "Cv is required"],
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'hired'],
        default: "pending"
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' 
    },
});

const applicationModel = mongoose.model("Application", applicationSchema);
export default applicationModel;