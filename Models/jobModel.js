import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
    title :{
        type : String,
        required :true
    },
    description:{
        type : String,
        required :true
    },
    category:{
        type : String,
        required :true
    },
    location:{
        type : String,
        required :true
    },
    salary:{
        type :Number ,
    },
    type:{
        type: String,
        enum:['Full-time', 'Part-time', 'Remote', 'Freelance'],
        required: true
    },
    status:{
        type: String,
        enum:['Open', 'Closed'],
        default: 'Open'
    },
    employer:{
        type:mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
},{
    timestamps: true
});

export default mongoose.model('Job', jobSchema);