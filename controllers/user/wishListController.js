const User=require("../../models/userSchema");
const product=require("../../models/productSchema");
const Product = require("../../models/productSchema");
const Cart=require("../../models/cartSchema");
const mongoose = require("mongoose");

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");
        const products = await Product.find({ _id: { $in: user.wishlist } }).populate("category");
        const cart = await Cart.findOne({ userId });
        const cartCount = cart && cart.items ? cart.items.length : 0;
        res.render("wishlist", {
            user,
            wishlist: products,
            cartCount,
            wishlistCount: user.wishlist?.length || 0
        });
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound");
    }
};

const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ status: false, message: "Invalid product ID" });
        }
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: false, message: "User not found" });
        }
        if (user.wishlist.includes(productId)) {
            return res.status(200).json({ status: false, message: "Product already in wishlist" });
        }
        user.wishlist.push(productId);
        await user.save();
        return res.status(200).json({ status: true, message: "Product added to wishlist" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error" });
    }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ status: false, message: "User not authenticated" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ status: false, message: "Invalid product ID" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    if (!user.wishlist.includes(productId)) {
      return res.status(200).json({ status: false, message: "Product not in wishlist" });
    }

    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    await user.save();

    return res.status(200).json({ 
      status: true, 
      message: "Product removed from wishlist",
      wishlistCount: user.wishlist.length
    });
  } catch (error) {
    console.error("Error in removeFromWishlist:", error.message, error.stack);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

module.exports={
    loadWishlist,
    addToWishlist,
    removeFromWishlist
}
