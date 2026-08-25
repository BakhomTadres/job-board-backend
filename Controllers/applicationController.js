import applicationModel from "../Models/applicationModel.js";

//! CRUD Operations
export const applyForJob = async (req,res) =>{
try{
    const newApplication = {
        ...req.body,
        jobId : req.params.id 
    };
    const application = await applicationModel
    .create (newApplication);
    
    res.status(201).json({
        message :"Application created",
         data : application
        });    
}catch(err){
    res.status(500).json({
        message :err.message
    });
}
};

export const getMyApplications = async (req,res) => {
    try{
        const applications = await applicationModel.find();
        res.status(200).json({
            message : "Applications showed",
            data : applications,
        });
}catch(err){
    res.status(500).json({
        message :err.message
    });
}
};

export const getJobApplications = async (req,res) => {
    try{
        const applications = await applicationModel.find({
            jobId : req.params.id
        });
        res.status(200).json({
            message : "Job Applications showed",
            data : applications,
        });
}catch(err){
    res.status(500).json({
        message :err.message
    });
}
};

export const updateApplicationStatus = async (req,res) => {
try{
    const {status} = req.body;
    if (!['pending','accepted','rejected','hired'].includes(status)){
        return res.status(400).json({
            message : "Invalid status value"
        });
    }
    const application = await applicationModel.findByIdAndUpdate(
        req.params.id,
        {status},
        {new : true},
    );
    if(!application){
        return res.status(404).json({
            message : "Application not found"
        }); 
    }
    res.status(200).json({
        message : "Applications status updated",
        data : application,
        });
}catch(err){
    res.status(500).json({
        message :err.message
    });
}
};

// import { 
//   applyForJob, 
//   getMyApplications, 
//   getJobApplications, 
//   updateApplicationStatus 
// } from "../Controllers/applicationController.js";