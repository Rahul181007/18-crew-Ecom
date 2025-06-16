const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const WishList=require("../../models/wishlistSchema");

const productDetails = async (req, res,next) => {
  try {
    const userId = req.session.user;
    const productId = req.query.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect('/page-not-found');
    }

    const userData = userId ? await User.findById(userId) : null;
    const cart = await Cart.findOne({ userId });
    const cartCount = cart && cart.items ? cart.items.length : 0;

    const wishlist = await WishList.findOne({ userId })
    const wishlistCount = wishlist ? wishlist.products.length : 0;

    const product = await Product.findById(productId)
      .populate("category")
      .populate("brand");

    if (!product) {
      return res.redirect('/page-not-found');
    }

    const isInWishlist = userData && userData.wishlist ? userData.wishlist.includes(productId) : false;
    const findCategory = product.category;
    const categoryOffer = findCategory?.categoryOffer || 0;
    const productOffer = product.productOffer || 0;

    // Determine the applicable offer
    let applicableOffer = 0;
    if (productOffer > 0 && productOffer >= categoryOffer) {
      applicableOffer = productOffer;
    } else if (categoryOffer > 0) {
      applicableOffer = categoryOffer;
    }

    // Adjust salePrice if an offer is applicable
    let adjustedSalePrice = product.salePrice;
    if (applicableOffer > 0) {
      adjustedSalePrice = product.regularPrice - (product.regularPrice * (applicableOffer / 100));
      adjustedSalePrice = Math.round(adjustedSalePrice); // Round to nearest integer
    }

    const totalQuantity = product.sizes.reduce((sum, size) => sum + size.stock, 0);
    const availableSizes = product.sizes.filter(size => size.stock > 0);

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
    })
      .select("productName salePrice regularPrice productImage brand")
      .populate("brand")
      .limit(6);

    res.render("product-details", {
      user: userData,
      product: {
        ...product._doc,
        salePrice: adjustedSalePrice, 
        totalQuantity,
      },
      totalOffer: applicableOffer, 
      category: findCategory,
      relatedProducts,
      availableSizes,
      cartCount,
      wishlistCount,
      isInWishlist,
      page: 'product-details',
      title: "Product-details"
    });
  } catch (error) {
    next(error)
  }
};

module.exports = { productDetails };