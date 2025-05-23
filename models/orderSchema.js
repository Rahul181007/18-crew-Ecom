const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema(
  {
    orderId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
    },
    orderedItems: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          default: 0,
        },
        size: {
          type: String,
          required: true,
          enum: ['S', 'M', 'L', 'XL', 'XXL'],
        },
        returnReason: {
          type: String,
          default: null,
        },
        returnRequestedAt: {
          type: Date,
          default: null,
        },
        returnStatus: {
          type: String,
          enum: [null, "Requested", "Returned", "Rejected"], // Changed "Approved" to "Returned"
          default: null,
        },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
    },
    selectedAddress: {
      addressType: { type: String },
      name: { type: String },
      city: { type: String },
      landMark: { type: String },
      state: { type: String },
      pincode: { type: Number },
      mobile: { type: String },
      altMobile: { type: String },
    },
    invoiceDate: {
      type: Date,
    },
    status: {
      type: String,
      required: true,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return Request", "Returned", "Partially Returned"], // Added "Partially Returned"
    },
    createdOn: {
      type: Date,
      default: Date.now,
      required: true,
    },
    couponApplied: {
      type: Boolean,
      default: false,
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "wallet", "razorpay"],
      required: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    trackingNumber: {
      type: String,
      default: null,
    },
    trackingUrl: {
      type: String,
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;