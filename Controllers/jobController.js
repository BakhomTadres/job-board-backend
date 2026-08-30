import Job from "../Models/jobModel.js";
import Application from "../Models/applicationModel.js";

//==================================================
export const createJob = async (req, res) => {
    try {
        const newJob = await Job.create({
            ...req.body,
            employer: req.user._id 
        });        
        return res.status(201).json({
            message: "Job has been created successfully",
            data: newJob
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
//==================================================
export const getAllJobs = async (req, res) => {
    try {
        const { location, companyName, type , search , page , limit } = req.query;
        const queryObject = {};

        if (location) {
            queryObject.location = location;
        }
        if (companyName) {
            queryObject.companyName = companyName;
        }
        if (type) {
            queryObject.type = type;
        }
        if (search) {
            queryObject.$or = [
                { title: { $regex: search, $options: "i" } },
                { companyName: { $regex: search, $options: "i" } },
            ];
        }

        let query = Job.find(queryObject);
        query = query.sort('-createdAt');

        const pageNumber = Number(page) || 1; 
        const limitNumber = Number(limit) || 10; 
        const skip = (pageNumber - 1) * limitNumber; 
        query = query.skip(skip).limit(limitNumber);

         const jobs = await query;

        return res.status(200).json({ results: jobs.length, data: jobs });        


    } catch (err) {
        return res.status(500).json({ message: err.message });
    }


};
//==================================================
export const getJobById=async(req,res)=>
{
    try {
const job=await 
Job.findById(req.params.id);
if(!job)
{
    return res.status(404).json({
        message:"job not found"
    });
}
res.status(200).json(job);
    }
    catch(error){
        res.status(500).json({
            message: error.message
        });
    } 
};
//==================================================
export const updateJob=async(req,res)=>
{
    try
    {
        const job= await
        Job.findByIdAndUpdate(
            req.params.id,
            req.body,
            {new:true}
        );
        if(!job)
        {
            return res.status(404).json({
               message:"job not found" 
            });
        }
res.status(200).json(job);
    }
     catch(error){
        res.status(500).json({
            message: error.message
  
        });
    }
};
//==================================================
export const deleteJob =async(req,res)=>
{
    try{
    const job=await
    Job.findByIdAndDelete
       ( req.params.id );
    if(!job)
    {
        return
         res.status(404).json({
           message:"job not found" 
        })
    }
    res.status(200).json({
        message:"successfuly"
    });
}
catch(error){
    res.status(500).json({
        message:error.message
    });
}
};
//==================================================
export const getRecommendedJobs = async (req, res) => {
    try{
        // const userId = req.user._id;
        // const userApplications = await Application.find({ userId: userId });
        // const appliedJobIds =  userApplications.map(app => app.jobId);
        // const appliedJobs = await Job.find({ _id: { $in: appliedJobIds } })
        // let userInterests = appliedJobs.flatMap(job => job.skills);
        // userInterests = [...new Set(userInterests)];
        // const recommendedJobs = await Job.find({skills: { $in: userInterests }, _id: { $nin: appliedJobIds }});
        const userId = req.user._id || req.user.id; 
        console.log("1. User ID:", userId);

        const userApplications = await Application.find({ userId: userId });
        console.log("2. Applications Found:", userApplications.length);

        const appliedJobIds = userApplications.map(app => app.jobId);
        const appliedJobs = await Job.find({ _id: { $in: appliedJobIds } });

        let userInterests = appliedJobs.flatMap(job => job.skills);
        userInterests = [...new Set(userInterests)];
        console.log("3. User Interests (Skills):", userInterests);

        const recommendedJobs = await Job.find({ skills: { $in: userInterests }, _id: { $nin: appliedJobIds } });
        res.status(200).json({
             status: "success",
             results: recommendedJobs.length,
             data: { jobs: recommendedJobs }
         });

    } catch (err) {
        res.status(500).json({
        status: "error",
        message: err.message
    });
  }
};
