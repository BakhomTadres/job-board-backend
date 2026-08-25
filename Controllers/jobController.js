import Job from "../Models/jobModel.js";

//==================================================
export const createJob = async (req, res) => {
    try {
        const newJob = await Job.create(req.body);
        
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
        const { location, category, type , search , page , limit } = req.query;
        const queryObject = {};

        if (location) {
            queryObject.location = location;
        }
        if (category) {
            queryObject.category = category;
        }
        if (type) {
            queryObject.type = type;
        }
        if (search) {
            queryObject.title = { $regex: search, $options: 'i' };
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


}
//==================================================