const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema'); 
const User = require('../../models/userSchema'); 
const mongoose = require('mongoose');
const mongodb=require('mongodb');
const WishList=require("../../models/wishlistSchema")


const getCartPage = async (req, res) => {
  try {
    const userId = req.session.user?._id || req.session.user;
    if (!userId) return res.redirect("/signin");
const user = await User.findById(userId).select('name email'); 
    if (!user) return res.redirect("/signin");
   
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: {
        path: 'category',
        select: 'name'
      }
    });

    if (!cart || cart.items.length === 0) {
      return res.render("cart", {
        user: req.session.user,
        quantity: 0,
        data: [],
        grandTotal: 0,
        page: 'cart',
        pageTitle: 'Your Cart'
      });
    }

    let grandTotal = 0;

    const cartItems = cart.items.map(item => {
      if (!item.productId) return null;

      const itemTotal = item.price * item.quantity;
      grandTotal += itemTotal;

      
      return {
        _id: item._id,
        productId: item.productId._id,
        productDetails: [item.productId],
        quantity: item.quantity,
        size: item.size,
        price: item.price,
        totalPrice: itemTotal
      };
    }).filter(Boolean);

    res.render("cart", {
      user: user,
      quantity: cartItems.length,
      data: cartItems,
      grandTotal,
      page: 'cart',
      pageTitle: 'Your Cart'
    });

  } catch (error) {
    console.error("Error in getCartPage:", error);
    res.redirect("/pageNotFound");
  }
};


const addToCart = async (req, res) => {
    try {
        const { productId, size, fromWishlist } = req.body;
        
        const userId = req.session.user?._id || req.session.user;
        if (!userId) return res.status(401).json({ success: false, message: "User not authenticated" });

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        const sizeObj = product.sizes.find(s => s.size === size);
        if (!sizeObj || sizeObj.stock <= 0) {
            return res.status(400).json({ success: false, message: "Selected size is out of stock" });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const existingItem = cart.items.find(item => 
            item.productId.toString() === productId && item.size === size
        );

        if (existingItem) {
            const newQuantity = existingItem.quantity + 1;
            if (newQuantity > 3 || newQuantity > sizeObj.stock) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Maximum ${Math.min(3, sizeObj.stock)} items allowed for this size` 
                });
            }
            existingItem.quantity = newQuantity;
            existingItem.totalPrice = newQuantity * product.salePrice;
        } else {
            cart.items.push({
                productId,
                quantity: 1,
                size,
                price: product.salePrice,
                totalPrice: product.salePrice
            });
        }

        await cart.save();

        // Remove from wishlist if requested
        if (fromWishlist) {
            const user = await User.findById(userId);
            if (user && user.wishlist.includes(productId)) {
                user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
                await user.save();
            }
        }

        return res.json({ 
            status: true, 
            message: fromWishlist ? "Product added to cart and removed from wishlist" : "Product added to cart" 
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: "Server error" });
    }
};

const changeQuantity = async (req, res) => {
  try {
    const { cartItemId, newQuantity } = req.body;
    const userId = req.session.user?._id || req.session.user;

    if (!userId) return res.status(401).json({ success: false, message: "User not authenticated" });

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const item = cart.items.id(cartItemId);
    if (!item) return res.status(404).json({ success: false, message: "Cart item not found" });

    item.quantity = newQuantity;
    item.totalPrice = newQuantity * item.productId.salePrice;

    await cart.save();

    const newGrandTotal = cart.items.reduce((sum, i) => sum + (i.quantity * i.productId.salePrice), 0);

    res.json({
      success: true,
      newSubTotal: item.quantity * item.productId.salePrice,
      newGrandTotal,
      message: "Quantity updated successfully"
    });

  } catch (error) {
    console.error("Change quantity error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const userId = req.session.user?._id || req.session.user;

    if (!userId) return res.status(401).json({ success: false, message: "User not authenticated" });

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const itemIndex = cart.items.findIndex(item => item._id.toString() === cartItemId);
    if (itemIndex === -1) return res.status(404).json({ success: false, message: "Cart item not found" });

    // Remove the item from the array
    cart.items.splice(itemIndex, 1);

    await cart.save();

    const newGrandTotal = cart.items.reduce((sum, i) => sum + (i.quantity * i.productId.salePrice), 0);

    res.json({
      success: true,
      newGrandTotal,
      message: "Item removed from cart"
    });

  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  deleteProduct
};