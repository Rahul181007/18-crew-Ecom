const mongoose=require("mongoose");
const {Schema}=mongoose;

const userSchema= new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true   // email should be unique
    },
    password:{
        type:String,
        required:false
    },
    mobile:{
        type:String,
        required:false,
        unique:true,
        sparse:true,
        default:null
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
        required: false
    },

    googleId: {
        type: String,
        unique: true,
        sparse: true, // 👈 this is important
        default:null
      }
,      
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
       type:Boolean,
       default:false 
    },
    cart:[{
         type:Schema.Types.ObjectId,
         ref:"Cart"
    }],
    wallet:{
        type:String,
        default:0
    },
    wishlist:[{
        type:Schema.Types.ObjectId,
        ref:"WishList"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"

    }],
    createdOn:{
        type:Date,
        default:Date.now
    },
    referalCode:{
        type:String
    },
    redeemed:{
        type:Boolean,
    },
    redeemedUser:{
        type:Schema.Types.ObjectId,
        ref:"User"
    },
    
    searchHistory:[{
        category:[{
            type:Schema.Types.ObjectId,
            ref:"Category"
        }],
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }

    }] 
   
})

const User= mongoose.model("User",userSchema);
module.exports=User;