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

    const isBuyNowOrder = buyNow === 'true' || buyNow === true;

    if (!totalPrice || !addressId || !payment) {
      return res.status(400).json({ status: false, message: "Missing required fields" });
    }

    const validPaymentMethods = ['cod', 'wallet', 'razorpay'];
    if (!validPaymentMethods.includes(payment)) {
      return res.status(400).json({ status: false, message: "Invalid payment method" });
    }

    console.log('Request Body:', req.body);
    console.log('addressId:', addressId);
    console.log('userId:', userId);

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

    const validSizes = ['S', 'M', 'L', 'XL', 'XXL'];

    let orderedItems = [];
    let cart;

    if (isBuyNowOrder) {
      if (!productId || !size) {
        return res.status(400).json({ status: false, message: "Product ID and size are required for buy now" });
      }

      const normalizedSize = String(size).trim().toUpperCase();
      if (!validSizes.includes(normalizedSize)) {
        return res.status(400).json({ status: false, message: `Invalid size: ${size}. Must be one of ${validSizes.join(', ')}` });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ status: false, message: "Product not found" });
      }

      const sizeVariant = product.sizes.find(s =>
        String(s.size).trim().toUpperCase() === normalizedSize
      );

      if (!sizeVariant || sizeVariant.stock < 1) {
        return res.status(400).json({ 
          status: false, 
          message: `Size ${normalizedSize} is out of stock for ${product.productName}` 
        });
      }

      sizeVariant.stock -= 1;
      await product.save();

      orderedItems = [{
        product: product._id,
        quantity: 1,
        price: product.salePrice,
        size: normalizedSize
      }];

      console.log('Buy Now orderedItems:', orderedItems);
    } else {
      cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ status: false, message: "Cart is empty" });
      }

      for (const item of cart.items) {
        if (!item.size) {
          console.error(`Cart item for product ${item.productId.productName} has undefined size`);
          return res.status(400).json({
            status: false,
            message: `Size is undefined for product ${item.productId.productName}`,
          });
        }

        const normalizedSize = String(item.size).trim().toUpperCase();
        if (!validSizes.includes(normalizedSize)) {
          return res.status(400).json({
            status: false,
            message: `Invalid size ${item.size} for product ${item.productId.productName}. Must be one of ${validSizes.join(', ')}`,
          });
        }

        const product = await Product.findById(item.productId._id);
        if (!product) {
          return res.status(400).json({ 
            status: false, 
            message: `Product ${item.productId.productName} not found` 
          });
        }

        const sizeVariant = product.sizes.find(s =>
          String(s.size).trim().toUpperCase() === normalizedSize
        );

        if (!sizeVariant || sizeVariant.stock < item.quantity) {
          return res.status(400).json({ 
            status: false, 
            message: `Insufficient stock for ${item.productId.productName} in size ${normalizedSize}` 
          });
        }

        sizeVariant.stock -= item.quantity;
        await product.save();

        orderedItems.push({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.productId.salePrice,
          size: normalizedSize
        });
      }

      
    }

    let paymentDetails = {
      paymentMethod: payment,
      isPaid: payment === 'wallet',
      paidAt: payment === 'wallet' ? new Date() : null
    };

    if (payment === 'wallet') {
      const user = await User.findById(userId);
      if (user.walletBalance < totalPrice) {
        return res.status(400).json({ status: false, message: "Insufficient wallet balance" });
      }

      user.walletBalance -= totalPrice;
      await user.save();
    }

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

    console.log('New order before save:', newOrder);

    const savedOrder = await newOrder.save();

    if (!isBuyNowOrder && cart) {
      await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [], couponApplied: null } },
        { new: true }
      );
    }

    if (couponCode) {
      await Coupon.findOneAndUpdate(
        { code: couponCode },
        { $addToSet: { usedBy: userId } }
      );
    }

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



    res.render('order-details', { order });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.redirect("/pageNotFound");
  }
};



const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user?._id || req.session.user;

    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.userId.toString() !== userId.toString()) {
      
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this order",
      });
    }

    if (order.status !== "Pending" && order.status !== "Processing") {
      console.error(`Order ${orderId} cannot be cancelled in status ${order.status}`);
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled in its current status",
      });
    }

    const validSizes = ['S', 'M', 'L', 'XL', 'XXL'];
    let stockUpdated = false;

    for (const item of order.orderedItems) {
      if (!item.product) {
        console.error(`Product not found for item ${item._id} in order ${orderId}`);
        return res.status(400).json({
          success: false,
          message: `Product not found for item in order`,
        });
      }

      const product = await Product.findById(item.product._id);
      if (!product) {
        console.error(`Product ${item.product.productName} not found for order ${orderId}`);
        return res.status(400).json({
          success: false,
          message: `Product ${item.product.productName} not found`,
        });
      }

      

      if (!item.size || !validSizes.includes(item.size.trim().toUpperCase())) {
        console.warn(`Invalid or undefined size "${item.size}" for product ${product.productName} in order ${orderId}. Skipping stock update.`);
        continue;
      }

      const sizeVariant = product.sizes.find(s =>
        String(s.size).trim().toUpperCase() === String(item.size).trim().toUpperCase()
      );

      if (!sizeVariant) {
        console.error(`Size ${item.size} not found for product ${product.productName} in order ${orderId}`);
        console.error(`Available sizes:`, product.sizes.map(s => s.size));
        return res.status(400).json({
          success: false,
          message: `Size ${item.size} not found for product ${product.productName}`,
        });
      }

     
      sizeVariant.stock += item.quantity;
      stockUpdated = true;
     
      await product.save();
      
      const updatedProduct = await Product.findById(item.product._id);
      const updatedSizeVariant = updatedProduct.sizes.find(s =>
        String(s.size).trim().toUpperCase() === String(item.size).trim().toUpperCase()
      );
      
    }

    if (!stockUpdated) {
      console.warn(`No stock updates performed for order ${orderId}. Check orderedItems sizes.`);
    }

    if (order.isPaid) {
      if (order.paymentMethod === "wallet") {
        const user = await User.findById(userId);
        if (!user) {
          console.error(`User ${userId} not found for refund in order ${orderId}`);
          return res.status(400).json({
            success: false,
            message: "User not found for refund",
          });
        }
        user.walletBalance += order.finalAmount;
        await user.save();
        console.log(`Refunded ${order.finalAmount} to wallet for user ${userId}`);
      } else if (order.paymentMethod === "razorpay") {
        console.log(`Initiate Razorpay refund for order ${orderId}`);
      }
    }

    order.status = "Cancelled";
    await order.save();
    

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while cancelling the order",
    });
  }
};



const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemId, reason } = req.body;
    const userId = req.session.user?._id || req.session.user;

    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.userId.toString() !== userId.toString()) {
      console.error(`User ${userId} not authorized to return order ${orderId}`);
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to return this order',
      });
    }

    // Allow returns for "Delivered" or "Partially Returned" orders
    if (order.status !== 'Delivered' && order.status !== 'Partially Returned') {
      console.error(`Order ${orderId} cannot be returned in status ${order.status}`);
      return res.status(400).json({
        success: false,
        message: 'Order must be in Delivered or Partially Returned status to request a return',
      });
    }

    // Check return window (7 days, matching frontend logic)
    const deliveredDate = order.updatedAt; // Ideally, use a deliveredAt field
    const daysSinceDelivery = Math.floor((new Date() - new Date(deliveredDate)) / (1000 * 60 * 60 * 24));
    if (daysSinceDelivery > 7) {
      console.error(`Return window expired for order ${orderId}. Delivered ${daysSinceDelivery} days ago.`);
      return res.status(400).json({
        success: false,
        message: 'Return window has expired (7 days after delivery)',
      });
    }

    const item = order.orderedItems.find(i => i._id.toString() === itemId);
    if (!item) {
      console.error(`Item ${itemId} not found in order ${orderId}`);
      return res.status(400).json({
        success: false,
        message: "Item not found in order",
      });
    }

    if (item.returnStatus === "Requested") {
      console.log(`Return already requested for item ${itemId} in order ${orderId}`);
      return res.status(400).json({
        success: false,
        message: "Return request already submitted for this item",
      });
    }

    if (item.returnStatus === "Returned") {
      console.log(`Item ${itemId} in order ${orderId} already returned`);
      return res.status(400).json({
        success: false,
        message: "Item has already been returned",
      });
    }

    // Update item with return request
    item.returnReason = reason;
    item.returnRequestedAt = new Date();
    item.returnStatus = "Requested";

    // Update order status
    const hasOtherReturnedItems = order.orderedItems.some(i => (i.returnStatus === "Returned" || i.returnStatus === "Requested") && i._id.toString() !== itemId);
    if (hasOtherReturnedItems) {
      order.status = "Partially Returned"; // Already in this state, but ensuring consistency
    } else {
      order.status = "Return Request";
    }

    await order.save();
    console.log(`Return requested for item ${itemId} in order ${orderId}`);

    res.status(200).json({
      success: true,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    console.error('Error requesting return:', error);
    res.status(500).json({
      success: false,
      message: "An error occurred while requesting the return",
    });
  }
};

module.exports={
    loadCheckout,
    deleteProduct,
    placeOrder,
    checkStock,
    successPage,
    orderDetails,
    cancelOrder,
    returnOrder
}