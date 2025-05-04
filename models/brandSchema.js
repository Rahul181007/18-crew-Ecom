const mongooose=require("mongoose");
const {Schema}=mongooose;

const brandSchema= new Schema({
    brandName:{
        type:String,
        required:true
    },
    brandImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
})

const Brand=mongooose.model("Brand",brandSchema);
module.exports=Brand;