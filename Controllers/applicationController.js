import applicationModel from "../Models/applicationModel.js";
import jobModel from "../Models/jobModel.js";
import userModel from "../Models/userModel.js";
import { calculateMatchScore } from "../Services/matchScore.service.js";


export const applyForJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user._id;

    const job = await jobModel.findById(jobId);
    const user = await userModel.findById(userId);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // منع التقديم مرتين على نفس الوظيفة
    const existingApp = await applicationModel.findOne({ jobId, userId });
    if (existingApp) {
      return res.status(400).json({ message: "You already applied to this job" });
    }

    const matchScore = calculateMatchScore(user.skills, job.skills);

    const newApplication = {
      ...req.body,
      jobId: jobId,
      userId: userId,
      matchScore: matchScore
    };

    const application = await applicationModel.create(newApplication);

    res.status(201).json({
      message: "Application created",
      data: application
    });
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
};

export const getMyApplications = async (req, res) => {
  try {
    const userId = req.user._id;
    const applications = await applicationModel.find({ userId: userId });

    res.status(200).json({
      message: "Applications showed",
      data: applications,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
};

export const getJobApplications = async (req, res) => {
  try {
    const jobId = req.params.jobId || req.params.id;
    const job = await jobModel.findOne({
      _id: jobId,
      employer: req.user._id
    });

    if (!job) {
      return res.status(403).json({
        message: "You are not allowed to view these applications"
      });
    }

    const applications = await applicationModel
      .find({ jobId: jobId })
      .populate("userId", "name email skills")
      .sort({ matchScore: -1 });

    res.status(200).json({
      message: "Job Applications showed",
      data: applications,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'accepted', 'rejected', 'hired'].includes(status)) {
      return res.status(400).json({
        message: "Invalid status value"
      });
    }
    const application = await applicationModel.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    if (!application) {
      return res.status(404).json({
        message: "Application not found"
      });
    }
    res.status(200).json({
      message: "Applications status updated",
      data: application,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
};

