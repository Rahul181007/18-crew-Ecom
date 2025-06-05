const User=require("../../models/userSchema");
const product=require("../../models/productSchema");
const Product = require("../../models/productSchema");
const Cart=require("../../models/cartSchema");
const mongoose = require("mongoose");
const Wishlist=require("../../models/wishlistSchema");

const loadWishlist = async (req, res,next) => {
  try {
    const userId = req.session.user;
    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: 'products.product',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'brand', select: 'brandName' }
        ]
      });

    const cart = await Cart.findOne({ userId });
    const cartCount = cart?.items?.length || 0;
    const wishlistProducts = wishlist ? wishlist.products : [];

    res.render("wishlist", {
      wishlist: wishlistProducts,
      cartCount,
      wishlistCount: wishlistProducts.length,
      user: await User.findById(userId)
    });
  } catch (error) {
    next(error)
  }
};



const addToWishlist = async (req, res,next) => {
  try {
    const userId = req.session.user;
    const productId = req.body.productId;

    let wishlist = await Wishlist.findOne({ userId: userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId: userId,
        products: [{ product: productId }]
      });
    } else {
      const alreadyExists = wishlist.products.some(item => item.product.toString() === productId);
      if (alreadyExists) {
        return res.json({ status: false, message: 'Product already in wishlist' });
      }

      wishlist.products.push({ product: productId });
    }

    await wishlist.save();
    res.json({ status: true, message: 'Product added to wishlist', wishlistCount: wishlist.products.length });

  } catch (error) {
   next(error)
  }
};



const removeFromWishlist = async (req, res,next) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ status: false, message: "Invalid product ID" });
    }

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({ status: false, message: "Wishlist not found" });
    }

    // Find index of product in wishlist.products array
    const index = wishlist.products.findIndex(item => item.product.toString() === productId);
    if (index === -1) {
      return res.status(404).json({ status: false, message: "Product not in wishlist" });
    }

    // Remove the product from the array
    wishlist.products.splice(index, 1);
    await wishlist.save();

    return res.status(200).json({
      status: true,
      message: "Product removed from wishlist",
      wishlistCount: wishlist.products.length
    });
  } catch (error) {
    next(error)
  }
};


module.exports={
    loadWishlist,
    addToWishlist,
    removeFromWishlist
}
