const mongoose = require("mongoose");
const { Schema } = mongoose;

const searchHistorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  categories: [{ type: Schema.Types.ObjectId, ref: "Category" }], // Changed from singular to plural
  brand: { type: Schema.Types.ObjectId, ref: "Brand" }, // Assuming you have a Brand model
  keywords: [{ type: String }],
  searchOn: { type: Date, default: Date.now }
}, { timestamps: true });

searchHistorySchema.index({ userId: 1, searchOn: -1 }); // Good for querying by user with recent first

module.exports = mongoose.model("SearchHistory", searchHistorySchema);
