const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const Coupon = require("../../models/couponSchema");
const Cart=require("../../models/cartSchema")
const { isValidObjectId } = mongoose;


const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, size, buyNow } = req.query; // Changed from isBuyNow to buyNow
    console.log("Query parameters:", req.query);
    
    if (!userId) {
      console.log("No userId in session");
      return res.redirect("/signin");
    }

    const findUser = await User.findById(userId);
    if (!findUser) {
      console.log("User not found:", userId);
      return res.redirect("/shop");
    }

    const addressData = await Address.findOne({ userId });

    let products = [];
    let grandTotal = 0;
    let isCart = true;

    // Handle buy-now flow
    if (buyNow && productId && size) { // Changed from isBuyNow to buyNow
      console.log("Entering Buy Now flow");
      isCart = false;
      
      const product = await Product.findById(productId);
      console.log("Product:", product);
      if (!product) {
        console.log("Product not found for buy now:", productId);
        return res.redirect("/shop");
      }

      // Case-insensitive size comparison
      const sizeVariant = product.sizes.find(s => 
        String(s.size).trim().toLowerCase() === String(size).trim().toLowerCase()
      );
      console.log("Size variant:", sizeVariant);
      if (!sizeVariant) {
        console.log("Size not found:", size, "Available sizes:", product.sizes.map(s => s.size));
        return res.redirect("/shop");
      }

      if (sizeVariant.stock < 1) {
        console.log("Out of stock for buy now:", productId, size);
        return res.redirect("/shop");
      }

      products = [{
        productId: product._id,
        productDetails: product,
        quantity: 1,
        size: size,
        price: product.salePrice
      }];

      grandTotal = product.salePrice;
    } 
    // Handle cart flow
    else {
      console.log("Entering Cart flow");
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        console.log("Cart is empty for user:", userId);
        return res.redirect("/shop");
      }

      // Verify all items are in stock
      for (const item of cart.items) {
        const product = await Product.findById(item.productId._id);
        if (!product) {
          console.log("Product in cart not found:", item.productId._id);
          return res.redirect("/shop");
        }

        const sizeVariant = product.sizes.find(s => 
          String(s.size).trim().toLowerCase() === String(item.size).trim().toLowerCase()
        );

        if (!sizeVariant || sizeVariant.stock < item.quantity) {
          console.log("Insufficient stock for cart item:", item.productId._id, item.size);
          return res.redirect("/shop");
        }
      }

      products = cart.items.map(item => ({
        ...item.toObject(),
        productDetails: item.productId
      }));

      grandTotal = products.reduce((sum, item) => {
        return sum + item.quantity * item.productDetails.salePrice;
      }, 0);
    }

    // Find valid coupons
    const today = new Date();
    const findCoupons = await Coupon.find({
      isList: true,
      createdOn: { $lt: today },
      expireOn: { $gt: today },
      minimumPrice: { $lt: grandTotal },
    });

    let discount = 0;
    res.render("checkoutPage", {
      product: products,
      user: findUser,
      isCart,
      userAddress: addressData,
      grandTotal,
      discount,
      Coupon: findCoupons,
      cartCount: isCart ? products.length : 0,
      wishlistCount: findUser.wishlist?.length || 0,
      buyNowData: !isCart ? { productId, size } : null
    });
    
  } catch (error) {
    console.error("Checkout error:", error);
    res.redirect("/pageNotFound");
  }
};

const deleteProduct=async(req,res)=>{
  try {
    const id = req.query.id;
    const userId=req.session.user;
    const user=await User.findById(userId);
    const cartIndex=user.cart.findIndex((item)=>item.productId==id);
    user.cart.splice(cartIndex,1);
    await user.save();
    res.redirect("/checkout")
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound")
  }
}

const checkStock = async (req, res) => {
  try {

    const { productId, size } = req.query;
    console.log(req.query)
    const userId = req.session.user?._id; // Optional chaining for safety

    // Verify user is logged in
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Please login first" 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product Not Found" 
      });
    }

    // Check size availability
    const sizeVariant = product.sizes.find(s => s.size === size);
    if (!sizeVariant) {
      return res.status(400).json({
        success: false,
        message: `Size ${size} not available for ${product.productName}`
      });
    }

    // Check stock (default quantity to 1 for buy-now)
    const quantity = 1; // Or get from request if needed
    if (sizeVariant.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${product.productName} in size ${size}`,
        availableStock: sizeVariant.stock
      });
    }

    // Return success if in stock
    return res.json({
      success: true,
      message: "Product is available",
      availableStock: sizeVariant.stock,
      productName: product.productName,
      size: size
    });

  } catch (error) {
    console.error("Error in check stock:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

// Place Order
const placeOrder = async (req, res) => {
  try {
    const {
      totalPrice,
      addressId,
      addressIndex = 0,
      payment,
      discount = 0,
      buyNow,
      productId,
      size,
      couponCode
    } = req.body;

    const userId = new mongoose.Types.ObjectId(req.session.user?._id || req.session.user);

    // Convert buyNow to boolean properly
    const isBuyNowOrder = buyNow === 'true' || buyNow === true;

    // Validate required fields
    if (!totalPrice || !addressId || !payment) {
      return res.status(400).json({ status: false, message: "Missing required fields" });
    }

    const validPaymentMethods = ['cod', 'wallet', 'razorpay'];
    if (!validPaymentMethods.includes(payment)) {
      return res.status(400).json({ status: false, message: "Invalid payment method" });
    }
console.log('Request Body:', req.body); // Log the entire request body
    console.log('addressId:', addressId); // Log the addressId
    console.log('userId:', userId); // Log the userId
    // Validate and fetch Address document
  const addressDoc = await Address.findById(addressId);
if (!addressDoc) {
  return res.status(400).json({ status: false, message: "Address not found" });
}
if (!addressDoc.address || addressDoc.address.length === 0) {
  return res.status(400).json({ status: false, message: "No addresses found in Address document" });
}
if (!addressDoc.address[addressIndex]) {
  return res.status(400).json({ status: false, message: "Invalid address index" });
}

const selectedAddress = addressDoc.address[addressIndex];

    let orderedItems = [];
    let cart;

    if (isBuyNowOrder) {
      // Buy Now flow
      if (!productId || !size) {
        return res.status(400).json({ status: false, message: "Product ID and size are required for buy now" });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ status: false, message: "Product not found" });
      }

      const sizeVariant = product.sizes.find(s => 
        String(s.size).trim().toLowerCase() === String(size).trim().toLowerCase()
      );

      if (!sizeVariant || sizeVariant.stock < 1) {
        return res.status(400).json({ 
          status: false, 
          message: `Size ${size} is out of stock for ${product.productName}` 
        });
      }

      // Reduce stock
      sizeVariant.stock -= 1;
      await product.save();

      orderedItems = [{
        product: product._id,
        quantity: 1,
        price: product.salePrice,
        size: size
      }];
    } else {
      // Cart flow
      cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ status: false, message: "Cart is empty" });
      }

      // Verify stock and prepare ordered items
      for (const item of cart.items) {
        const product = await Product.findById(item.productId._id);
        if (!product) {
          return res.status(400).json({ 
            status: false, 
            message: `Product ${item.productId.productName} not found` 
          });
        }

        const sizeVariant = product.sizes.find(s => 
          String(s.size).trim().toLowerCase() === String(item.size).trim().toLowerCase()
        );

        if (!sizeVariant || sizeVariant.stock < item.quantity) {
          return res.status(400).json({ 
            status: false, 
            message: `Insufficient stock for ${item.productId.productName} in size ${item.size}` 
          });
        }

        // Reduce stock
        sizeVariant.stock -= item.quantity;
        await product.save();

        orderedItems.push({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.productId.salePrice,
          size: item.size
        });
      }
    }

    // Payment logic
    let paymentDetails = {
      paymentMethod: payment,
      isPaid: payment === 'wallet',
      paidAt: payment === 'wallet' ? new Date() : null
    };

    // Wallet deduction
    if (payment === 'wallet') {
      const user = await User.findById(userId);
      if (user.walletBalance < totalPrice) {
        return res.status(400).json({ status: false, message: "Insufficient wallet balance" });
      }

      user.walletBalance -= totalPrice;
      await user.save();
    }

    // Create order
    const newOrder = new Order({
      orderedItems,
      totalPrice: totalPrice + discount,
      discount: discount || 0,
      finalAmount: totalPrice,
      selectedAddress: {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        landMark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        mobile: selectedAddress.mobile,
        altMobile: selectedAddress.altMobile
      },
      status: "Pending",
      createdOn: new Date(),
      couponApplied: couponCode ? true : false,
      couponCode: couponCode || null,
      userId,
      ...paymentDetails
    });

    const savedOrder = await newOrder.save();

    // Clear cart if not Buy Now
    if (!isBuyNowOrder && cart) {
      await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [], couponApplied: null } },
        { new: true }
      );
    }

    // Mark coupon as used if applied
    if (couponCode) {
      await Coupon.findOneAndUpdate(
        { code: couponCode },
        { $addToSet: { usedBy: userId } }
      );
    }

    // Razorpay order (if applicable)
    if (payment === 'razorpay') {
      const razorpayOrder = await generateRazorpayOrder(savedOrder._id, totalPrice);
      return res.status(201).json({
        status: true,
        message: "Razorpay payment initiated",
        order: savedOrder,
        razorpayOrder
      });
    }

    res.status(201).json({
      status: true,
      message: "Order placed successfully",
      order: savedOrder
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Razorpay Order Generation (Placeholder)
async function generateRazorpayOrder(orderId, amount) {
  return {
    id: "rzp_test_" + Math.random().toString(36).substring(7),
    amount: amount * 100,
    currency: "INR"
  };
}






const successPage = async (req, res) => {
  try {
    const orderId = req.query.id;

    // Validate orderId
    if (!orderId || !isValidObjectId(orderId)) {
      console.log('Invalid or missing orderId:', orderId);
      return res.status(400).render('error', { message: 'Invalid order ID' });
    }

    // Fetch order and verify ownership
    const order = await Order.findOne({ _id: orderId, userId: req.session.user })
      .select('orderId orderedItems totalPrice finalAmount discount paymentMethod isPaid status trackingNumber trackingUrl createdOn')
      .populate('orderedItems.product'); // Populate product details

    if (!order) {
      console.log('Order not found for orderId:', orderId);
      return res.status(404).redirect('/pageNotFound');
    }

    // Log order for debugging
    console.log('Order:', JSON.stringify(order, null, 2));

    // Render success page with order details
    res.render('successPage', { order });
  } catch (error) {
    console.error(`Error in successPage controller for orderId ${req.query.id}:`, error);
    res.status(500).redirect('/pageNotFound');
  }
};
const orderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId })
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage',
      });

    if (!order) {
      console.log(`Order with ID ${orderId} not found`);
      return res.redirect("/pageNotFound");
    }

    console.log('Order:', order);
    console.log('Selected Address:', order.selectedAddress);

    res.render('order-details', { order });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.redirect("/pageNotFound");
  }
};

module.exports={
    loadCheckout,
    deleteProduct,
    placeOrder,
    checkStock,
    successPage,
    orderDetails
}