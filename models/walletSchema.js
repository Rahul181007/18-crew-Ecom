const mongoose=require("mongoose");
const {Schema}=mongoose;


const walletTransactionSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    type:{
        type:String,
        enum:["credit","debit"],
        required:true
    },
    amount:{
        type:Number,
        required:true
    },
    source:{
        type:String,
        required:true
    },
    reference:{
        type:String,
        default:null
    },
    date:{
        type:Date,
        default:Date.now()
    }
},{timestamps:true})

module.exports=mongoose.model("WalletTransaction",walletTransactionSchema)