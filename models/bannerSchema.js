const mongooose=require("mongoose");
const {Schema}=mongooose;

const bannerSchema=new Schema({
    image:{
        type:String,
        required:true
    },
    title:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    link:{
        type:String,
    },
    startDate:{
        type:Date,
        required:true
    },
    endDate:{
        type:Date,
        required:true
    }
})
const Banner=mongooose.model("Banner",bannerSchema);
module.exports=Banner;