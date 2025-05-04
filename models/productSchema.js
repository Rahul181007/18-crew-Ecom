const { Timestamp } = require("bson");
const mongoose=require("mongoose");
const {Schema}=mongoose;

const productSchema=new Schema({
    productName:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    size:{
     type:String,
     required:true
    },
    brand:{
        type:String,
        required:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    regularPrice:{
        type:Number,
        required:true
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0,
    },
    quantity:{
        type:Number,
        required:true
    },
    color:{
        type:String,
        required:true
    },
    productImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        required:false,

    },
    status:{
        type:String,
        enum:["Available","Out of stock","Duscontinued"], //this indicating which all status are there to put
        required:true,
        default:"Available"
    }

},{timestamps:true})

const Product=mongoose.model("Product",productSchema);

module.exports=Product;