const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true 
    },
    password: {
        type: String,
        required: false
    },
    mobile: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        default: null
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
        required: false
    },

    googleId: {
        type: String,
        unique: true,
        sparse: true,
        default: null
    }
    ,
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    wallet: {
        type: Number,
        default: 0
    },
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    createdOn: {
        type: Date,
        default: Date.now
    },
    referralCode: {
        type: String
    },
    redeemed: {
        type: Boolean,
    },
    redeemedUser: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    image: {
        type: String,
        default: ""
    },
    usedCoupons: [{
        couponId: {
            type: Schema.Types.ObjectId,
            ref: 'Coupon'
        },
        usedOn: {
            type: Date,
            default: Date.now
        }
    }],


}, { timestamps: true })

const User = mongoose.model("User", userSchema);
module.exports = User;