const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: /^[A-Z0-9]{4,10}$/,
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  expireOn: {
    type: Date,
    required: true,
  },
  discountType: {
    type: String,
    required: true,
    enum: ['price', 'percentage'],
    default: 'price',
  },
  offerPrice: {
    type: Number,
    required: function () {
      return this.discountType === 'price';
    },
    min: [0.01, 'Discount amount must be at least 0.01'],
  },
  offerPercentage: {
    type: Number,
    required: function () {
      return this.discountType === 'percentage';
    },
    min: [0.01, 'Discount percentage must be at least 0.01%'],
    max: [100, 'Discount percentage cannot exceed 100%'],
  },
  minimumPrice: {
    type: Number,
    required: true,
    min: [0, 'Minimum purchase amount cannot be negative'],
  },
  maxUsage: {
    type: Number,
    required: true,
    min: [1, 'Usage limit must be at least 1'],
  },
  isActive: {                  // <-- Add this to manage if coupon is enabled/disabled
    type: Boolean,
    default: true,
  },
  
  usedBy: [
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      usageDate: {
        type: Date,
        default: Date.now,
      },
    },
  ],
}, {
  timestamps: true,
});

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;