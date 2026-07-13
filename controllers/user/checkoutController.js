const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema");
const { isValidObjectId } = mongoose;
const Razorpay = require("razorpay");
const crypto = require("crypto");
const WishList = require("../../models/wishlistSchema")
const { logWalletTransaction } = require("../../utils/wallet");
const STATUS_CODE = require("../../constants/httpStatus");
const {
  WalletSources,
  TransactionTypes,
} = require("../../constants/walletConstants");

const PDFDocument = require("pdfkit");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const loadCheckout = async (req, res, next) => {
  try {
    const userId = req.session.user || req.session.user._id;

    const { productId, size, buyNow, orderId } = req.query;
    console.log("Query parameters:", req.query);
    const wishlist = await WishList.findOne({ userId: userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;

    if (!userId) {
      return res.status(STATUS_CODE.UNAUTHORIZED).redirect("/signin");
    }

    const findUser = await User.findById(userId);
    if (!findUser) {
      return res.status(STATUS_CODE.NOT_FOUND).redirect("/shop");
    }

    const addressData = await Address.findOne({ userId });

    let products = [];
    let grandTotal = 0;
    let isCart = true;
    let discount = 0;
    let couponDiscount = 0;
    let couponCode = null;
    let buyNowData = null;
    let subtotal = 0;

    const applyGeneralDiscount = (total) => {
      return total * 0.1; //  10% off
    };

    // Handle retry flow for existing order
    if (orderId && isValidObjectId(orderId)) {

      const order = await Order.findById(orderId).populate(
        "orderedItems.product"
      );
      if (!order || order.userId.toString() !== userId.toString()) {

        return res.redirect("/shop");
      }

      if (order.isPaid) {
        return res.redirect(`/successPage?id=${orderId}`);
      }

      isCart = !order.isBuyNowOrder;
      products = order.orderedItems.map((item) => ({
        productId: item.product._id,
        productDetails: item.product,
        quantity: item.quantity,
        size: item.size,
        price: item.price,
      }));

      subtotal = order.totalPrice;
      discount = order.discount || 0;
      couponDiscount = order.couponDiscount || 0;
      grandTotal = order.finalAmount;
      couponCode = order.tempCouponCode || order.couponCode;

      // Verify stock for retry
      for (const item of products) {
        const product = await Product.findById(item.productId);
        const sizeVariant = product.sizes.find(
          (s) =>
            String(s.size).trim().toLowerCase() ===
            String(item.size).trim().toLowerCase()
        );
        if (!sizeVariant || sizeVariant.stock < item.quantity) {
          console.log(
            "Insufficient stock for retry:",
            item.productId,
            item.size
          );
          return res.redirect("/shop");
        }
      }

      if (!isCart) {
        buyNowData = {
          productId: products[0].productId.toString(),
          size: products[0].size,
        };
      }
    } else {
      // Existing buy-now flow
      if (buyNow && productId && size) {
        console.log("Entering Buy Now flow");
        isCart = false;

        const product = await Product.findById(productId);
        if (!product) {
          console.log("Product not found for buy now:", productId);
          return res.redirect("/shop");
        }

        const sizeVariant = product.sizes.find(
          (s) =>
            String(s.size).trim().toLowerCase() ===
            String(size).trim().toLowerCase()
        );

        if (!sizeVariant || sizeVariant.stock < 1) {
          console.log("Size not found or out of stock:", size, productId);
          return res.status(STATUS_CODE.BAD_REQUEST).redirect("/shop");
        }

        products = [
          {
            productId: product._id,
            productDetails: product,
            quantity: 1,
            size: size,
            price: product.salePrice,
          },
        ];

        subtotal = product.salePrice;
        discount = Math.round(applyGeneralDiscount(subtotal));
        grandTotal = subtotal - discount - couponDiscount;
        buyNowData = { productId, size };
      } else {
        console.log("Entering Cart flow");
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
          console.log("Cart is empty for user:", userId);
          return res.redirect("/shop");
        }

        for (const item of cart.items) {
          const product = await Product.findById(item.productId._id);
          const sizeVariant = product.sizes.find(
            (s) =>
              String(s.size).trim().toLowerCase() ===
              String(item.size).trim().toLowerCase()
          );
          if (!sizeVariant || sizeVariant.stock < item.quantity) {
            console.log(
              "Insufficient stock for cart item:",
              item.productId._id,
              item.size
            );
            return res.status(STATUS_CODE.BAD_REQUEST).redirect("/shop");
          }
        }

        products = cart.items.map((item) => ({
          ...item.toObject(),
          productDetails: item.productId,
        }));

        subtotal = products.reduce((sum, item) => {
          return sum + item.quantity * item.productDetails.salePrice;
        }, 0);

        discount = Math.round(applyGeneralDiscount(subtotal));

        grandTotal = subtotal - discount - couponDiscount;
      }
    }

    // Find valid coupons
    // In your route/controller where you fetch coupons:
    const today = new Date();

    // Get array of coupon IDs the user has already used
    const usedCouponIds = findUser.usedCoupons.map((uc) => uc.couponId);

    const findCoupons = await Coupon.find({
      isActive: true,
      createdOn: { $lt: today },
      expireOn: { $gt: today },
      minimumPrice: { $lt: grandTotal + discount },
      _id: { $nin: usedCouponIds }, // Exclude used coupons
    }).lean();

    console.log("Available coupons for user:", findCoupons);

    // Store coupon in session if retrying
    if (couponCode) {
      req.session.appliedCoupon = {
        couponId: couponCode,
        discount: couponDiscount,
      };
    }

    console.log({
      subtotal,
      discount,
      couponDiscount,
      grandTotal,
      isCart,
      products,
    });

    res.render("checkoutPage", {
      product: products,
      user: findUser,
      isCart,
      userAddress: addressData,
      subtotal,
      grandTotal,
      discount,
      couponDiscount,
      Coupon: findCoupons,
      cartCount: isCart ? products.length : 0,
      wishlistCount,
      buyNowData,
      orderId: orderId || null,
      title: "Checkout",
    });
  } catch (error) {
    next(error);
  }
};

const checkStockBeforeCheckout = async (req, res, next) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res
        .status(STATUS_CODE.UNAUTHORIZED)
        .json({ success: false, message: "Please signin proceed" });
    }
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ success: false, message: "your cart is empty" });
    }
    const outOfStockItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product) {
        outOfStockItems.push({
          productName: "Unknown Product",
          size: item.size,
        });
        continue;
      }
      const sizeVariant = product.sizes.find(
        (s) =>
          String(s.size).trim().toLowerCase() ===
          String(item.size).trim().toLowerCase()
      );
      if (!sizeVariant || sizeVariant.stock < item.quantity) {
        outOfStockItems.push({
          productName: product.productName,
          size: item.size,
          availableStock: sizeVariant ? sizeVariant.stock : 0,
          requestedQuantity: item.quantity,
        });
      }
    }
    if (outOfStockItems.length > 0) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message:
          "Some items in your cart are out of stock or have insufficient quantity.",
        outOfStockItems,
      });
    }
    return res
      .status(STATUS_CODE.OK)
      .json({
        success: true,
        message: "All items are in stock. Proceeding to checkout.",
      });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const id = req.query.id;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const cartIndex = user.cart.findIndex((item) => item.productId == id);
    user.cart.splice(cartIndex, 1);
    await user.save();
    res.redirect("/checkout");
  } catch (error) {
    next(error);
  }
};

const checkStock = async (req, res, next) => {
  try {
    const { productId, size } = req.query;

    const userId = req.session.user?._id;


    const user = await User.findById(userId);
    if (!user) {
      return res.status(STATUS_CODE.UNAUTHORIZED).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(STATUS_CODE.NOT_FOUND).json({
        success: false,
        message: "Product Not Found",
      });
    }

    // Check size availability
    const sizeVariant = product.sizes.find((s) => s.size === size);
    if (!sizeVariant) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: `Size ${size} not available for ${product.productName}`,
      });
    }

    // Check stock (default quantity to 1 for buy-now)
    const quantity = 1; // Or get from request if needed
    if (sizeVariant.stock < quantity) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: `Insufficient stock for ${product.productName} in size ${size}`,
        availableStock: sizeVariant.stock,
      });
    }

    // Return success if in stock
    return res.json({
      success: true,
      message: "Product is available",
      availableStock: sizeVariant.stock,
      productName: product.productName,
      size: size,
    });
  } catch (error) {
    next(error);
  }
};

const generateRazorpayOrder = async (orderId, amount) => {
  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: orderId ? `order_${orderId}` : `temp_${Date.now()}`,
  };
  const razorpayOrder = await razorpay.orders.create(options);
  if (!razorpayOrder.id) {
    throw new Error("Failed to create Razorpay order");
  }
  return razorpayOrder;
};

const placeOrder = async (req, res, next) => {
  try {
    const {
      totalPrice,
      finalAmount,
      addressId,
      addressIndex = 0,
      payment,
      generalDiscount = 0,
      couponDiscount = 0,
      couponCode,
      buyNow,
      productId,
      size,
      quantities,
    } = req.body;

    const userId = req.session.user || req.session.user._id;
    if (!userId) {
      return res
        .status(STATUS_CODE.UNAUTHORIZED)
        .json({ status: false, message: "User not authenticated" });
    }

    const isBuyNowOrder = buyNow === "true" || buyNow === true;

    if (!totalPrice || !addressId || !payment) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({ status: false, message: "Missing fields" });
    }

    const validPayments = ["cod", "wallet", "razorpay"];
    if (!validPayments.includes(payment)) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ status: false, message: "Invalid payment method" });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address || !address.address?.[addressIndex]) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ status: false, message: "Invalid address" });
    }

    let orderedItems = [];

    // Prepare items (no stock changes yet)
    if (isBuyNowOrder) {
      const product = await Product.findById(productId);
      if (!product)
        return res
          .status(STATUS_CODE.NOT_FOUND)
          .json({ status: false, message: "Product not found" });

      const sizeVariant = product.sizes.find(
        (s) => String(s.size).toUpperCase() === String(size).toUpperCase()
      );
      if (!sizeVariant || sizeVariant.stock < 1) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({ status: false, message: "Out of stock" });
      }

      orderedItems.push({
        product: productId,
        quantity: 1,
        price: product.salePrice,
        size,
      });
    } else {
      const cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart || cart.items.length === 0) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({ status: false, message: "Cart empty" });
      }

      for (const item of cart.items) {
        const product = item.productId;
        const quantity = quantities?.[product._id] || item.quantity;
        const sizeVariant = product.sizes.find(
          (s) =>
            String(s.size).toUpperCase() === String(item.size).toUpperCase()
        );

        if (!sizeVariant || sizeVariant.stock < quantity) {
          return res
            .status(STATUS_CODE.BAD_REQUEST)
            .json({
              status: false,
              message: `${product.productName} size ${item.size} is out of stock`,
            });
        }

        orderedItems.push({
          product: product._id,
          quantity,
          price: product.salePrice,
          size: item.size,
        });
      }
    }

    // Prepare order object (not saved yet for Razorpay)
    const orderData = {
      userId,
      orderedItems,
      totalPrice,
      discount: generalDiscount + couponDiscount,
      couponDiscount, // NEW: persist the coupon's portion separately
      finalAmount,
      selectedAddress: address.address[addressIndex],
      paymentMethod: payment,
      isPaid: payment === "wallet" ? true : false,
      couponApplied: !!couponCode,
      couponCode: payment === "razorpay" ? null : couponCode,
      tempCouponCode: payment === "razorpay" ? couponCode : null,
      status: payment === "razorpay" ? "Initiated" : "Pending",
      isBuyNowOrder,
    };

    if (payment === "razorpay") {
      // Store order details in session for Razorpay
      req.session.tempOrder = { ...orderData, addressId, addressIndex };
      const razorpayOrder = await generateRazorpayOrder(
        Date.now().toString(),
        finalAmount
      ); // Use temporary ID
      return res.status(200).json({
        status: true,
        order: orderData, // Send order data for client-side use
        razorpayOrder,
        message: "Razorpay order created",
      });
    }

    // Save order for COD or wallet
    const order = new Order(orderData);
    await order.save();

    // Wallet payment handling
    if (payment === "wallet") {
      try {
        await logWalletTransaction(
          userId,
          TransactionTypes.DEBIT,
          finalAmount,
          WalletSources.ORDER_PAYMENT,
          order._id
        );
      } catch (error) {
        await Order.findByIdAndDelete(order._id);
        return res.status(STATUS_CODE.BAD_REQUEST).json({ status: false, message: error.message });
      }
    }

    // Deduct stock for COD and wallet
    for (const item of orderedItems) {
      const product = await Product.findById(item.product);
      const sizeVariant = product.sizes.find(
        (s) => String(s.size).toUpperCase() === String(item.size).toUpperCase()
      );
      sizeVariant.stock -= item.quantity;
      await product.save();
    }
    // Handle coupon usage tracking (for non-Razorpay payments)
    if (req.session.appliedCoupon) {
      // Update coupon usage
      await Coupon.findByIdAndUpdate(req.session.appliedCoupon.couponId, {
        $push: { usedBy: { userId: userId, usageDate: new Date() } },
        $inc: { usageCount: 1 },
      });

      // Update user's used coupons
      await User.findByIdAndUpdate(userId, {
        $push: {
          usedCoupons: {
            couponId: req.session.appliedCoupon.couponId,
            usedOn: new Date(),
          },
        },
      });

      // Clear applied coupon from session
      delete req.session.appliedCoupon;
    }

    // Clear cart for non-Buy Now orders
    if (!isBuyNowOrder) {
      await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [], couponApplied: null } }
      );
    }

    req.session.appliedCoupon = null;

    return res.status(200).json({
      status: true,
      order,
      message: "Order placed successfully",
    });
  } catch (error) {
    next(error);
  }
};
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Invalid payment, no order saved
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        status: false,
        message: "Invalid payment signature",
        redirect: `/failedPage?message=${encodeURIComponent(
          "Invalid payment signature"
        )}`,
      });
    }

    // Retrieve temp order from session
    const tempOrder = req.session.tempOrder;
    if (!tempOrder) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        status: false,
        message: "No pending order found",
        redirect: `/failedPage?message=${encodeURIComponent(
          "No pending order found"
        )}`,
      });
    }

    // Validate stock again before saving
    for (const item of tempOrder.orderedItems) {
      const product = await Product.findById(item.product);
      const sizeVariant = product.sizes.find(
        (s) => String(s.size).toUpperCase() === String(item.size).toUpperCase()
      );
      if (!sizeVariant || sizeVariant.stock < item.quantity) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({
          status: false,
          message: `${product.productName} size ${item.size} is out of stock`,
          redirect: `/failedPage?message=${encodeURIComponent(
            `${product.productName} size ${item.size} is out of stock`
          )}`,
        });
      }
    }

    // Save order to database
    const order = new Order({
      ...tempOrder,
      isPaid: true,
      status: "Pending",
      paymentMethod: "razorpay",
      razorpayDetails: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature,
      },
      paidAt: new Date(),
    });
    await order.save();

    // Deduct stock
    for (const item of order.orderedItems) {
      const product = await Product.findById(item.product);
      const sizeVariant = product.sizes.find(
        (s) => String(s.size).toUpperCase() === String(item.size).toUpperCase()
      );
      sizeVariant.stock -= item.quantity;
      await product.save();
    }

    // Apply coupon
    if (order.tempCouponCode) {
      const coupon = await Coupon.findOne({ name: order.tempCouponCode });
      if (coupon) {
        // Update coupon usage
        await Coupon.findByIdAndUpdate(coupon._id, {
          $push: { usedBy: { userId: order.userId, usageDate: new Date() } },
          $inc: { usageCount: 1 },
        });

        // Update user's used coupons
        await User.findByIdAndUpdate(order.userId, {
          $push: {
            usedCoupons: {
              couponId: coupon._id,
              usedOn: new Date(),
            },
          },
        });

        order.couponCode = order.tempCouponCode;
        order.tempCouponCode = null;
        await order.save();
      }
    }

    // Clear cart for non-Buy Now orders
    if (!order.isBuyNowOrder) {
      await Cart.findOneAndUpdate(
        { userId: order.userId },
        { $set: { items: [], couponApplied: null } }
      );
    }

    // Clear session data
    req.session.tempOrder = null;
    req.session.appliedCoupon = null;

    return res.status(200).json({
      status: true,
      message: "Payment verified successfully",
      orderId: order._id,
    });
  } catch (error) {
    console.error("verifyPayment error:", error);
    return res.status(500).json({
      status: false,
      message: "Payment verification failed",
      redirect: `/failedPage?message=${encodeURIComponent(
        "Payment verification failed"
      )}`,
    });
  }
};
const failedPage = async (req, res, next) => {
  try {
    const { message } = req.query;

    if (!req.session.user) {
      console.log("No user in session");
      return res.redirect("/signin");
    }

    const tempOrder = req.session.tempOrder;
    if (!tempOrder || tempOrder.paymentMethod !== "razorpay") {
      return res.status(STATUS_CODE.BAD_REQUEST).render("failedPage", {
        message: message || "No pending order found",
        orderId: null,
        productId: null,
        size: null,
        isBuyNow: false,
        user: req.session.user,
        retryAvailable: false,
      });
    }

    const isBuyNow = tempOrder.isBuyNowOrder;
    let productId, size;

    if (isBuyNow) {
      productId = tempOrder.orderedItems[0]?.product?.toString();
      size = tempOrder.orderedItems[0]?.size;

      if (!productId || !size) {
        console.log("Missing productId or size in Buy Now temp order");
        return res.status(STATUS_CODE.BAD_REQUEST).render("failedPage", {
          message: "Invalid Buy Now order details",
          orderId: null,
          productId: null,
          size: null,
          isBuyNow: false,
          user: req.session.user,
          retryAvailable: false,
        });
      }
    }

    res.render("failedPage", {
      message: message || "Payment failed. Please try again.",
      orderId: null, // No order in DB
      productId: isBuyNow ? productId : null,
      size: isBuyNow ? size : null,
      isBuyNow,
      user: req.session.user,
      retryAvailable: true, // Enable retry for Razorpay
      tempOrder: tempOrder, // Pass temp order for retry form
      title: "FailedPage",
    });
  } catch (error) {
    next(error);
  }
};
const successPage = async (req, res, next) => {
  try {
    const orderId = req.query.id;

    // Validate orderId
    if (!orderId || !isValidObjectId(orderId)) {
      console.log("Invalid or missing orderId:", orderId);
      return res.status(STATUS_CODE.BAD_REQUEST).render("error", { message: "Invalid order ID" });
    }

    // Fetch order and verify ownership
    const order = await Order.findOne({
      _id: orderId,
      userId: req.session.user,
    })
      .select(
        "orderId orderedItems totalPrice finalAmount discount paymentMethod isPaid status trackingNumber trackingUrl createdOn"
      )
      .populate("orderedItems.product"); // Populate product details

    if (!order) {
      console.log("Order not found for orderId:", orderId);
      return res.status(STATUS_CODE.NOT_FOUND).redirect("/pageNotFound");
    }
    // Render success page with order details
    res.status(STATUS_CODE.OK).render("successPage", { order, title: "SuccessPage" });
  } catch (error) {
    next(error);
  }
};
const orderDetails = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const wishlist = await WishList.findOne({ userId });
    const cart = await Cart.findOne({ userId });
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId }).populate({
      path: "orderedItems.product",
      select: "productName productImage",
    });

    if (!order) {
      console.log(`Order with ID ${orderId} not found`);
      return res.redirect("/pageNotFound");
    }

    res.render("order-details", {
      order,
      user,
      wishlistCount: wishlist ? wishlist.products.length : 0,
      cartCount: cart && cart.items ? cart.items.length : 0,
      title: "Order Details",
    });
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user?._id || req.session.user;

    const order = await Order.findOne({ orderId }).populate(
      "orderedItems.product"
    );
    if (!order)
      return res
        .status(STATUS_CODE.NOT_FOUND)
        .json({ success: false, message: "Order not found" });

    if (order.userId.toString() !== userId.toString())
      return res.status(STATUS_CODE.FORBIDDEN).json({ success: false, message: "Unauthorized" });

    if (
      !["Pending", "Processing", "Partially Cancelled"].includes(order.status)
    )
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({
          success: false,
          message: "Order cannot be cancelled in current status",
        });

    const validSizes = ["S", "M", "L", "XL", "XXL"];
    let stockUpdated = false;
    let refundAmount = 0;

    // Total MRP before cancellation
    const totalMrp = order.orderedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const paidAmount = order.finalAmount;

    for (const item of order.orderedItems) {
      if (item.status === "Cancelled") continue;

      if (
        item.product &&
        item.size &&
        validSizes.includes(item.size.trim().toUpperCase())
      ) {
        const product = await Product.findById(item.product._id);
        if (product) {
          const sizeVariant = product.sizes.find(
            (s) =>
              s.size.trim().toUpperCase() === item.size.trim().toUpperCase()
          );
          if (sizeVariant) {
            sizeVariant.stock += item.quantity;
            stockUpdated = true;
            await product.save();
          }
        }
      }

      const itemMrpTotal = item.price * item.quantity;
      const itemRefundAmount = (itemMrpTotal / totalMrp) * paidAmount;
      refundAmount += itemRefundAmount;

      item.status = "Cancelled";
      item.refundedAmount = itemRefundAmount;
      item.isRefunded = order.isPaid;
    }

    if (order.isPaid && refundAmount > 0) {
      await logWalletTransaction(
        userId,
        TransactionTypes.CREDIT,
        Math.round(refundAmount),
        WalletSources.ORDER_REFUND,
        order.orderId
      );
    }

    order.status = "Cancelled";
    order.refundedAmount = (order.refundedAmount || 0) + refundAmount;
    order.isFullyRefunded = order.isPaid;
    await order.save();

    return res.status(STATUS_CODE.OK).json({
      success: true,
      message: `Order cancelled successfully${order.isPaid ? " and refund processed" : ""
        }`,
    });
  } catch (error) {
    next(error);
  }
};

const cancelOrderItem = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.session.user?._id || req.session.user;

    const order = await Order.findOne({ orderId }).populate(
      "orderedItems.product"
    );
    if (!order)
      return res
        .status(STATUS_CODE.NOT_FOUND)
        .json({ success: false, message: "Order not found" });

    if (order.userId.toString() !== userId.toString())
      return res.status(STATUS_CODE.FORBIDDEN).json({ success: false, message: "Unauthorized" });

    if (!["Pending", "Processing"].includes(order.status))
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({
          success: false,
          message: "Order cannot be cancelled in current status",
        });

    const item = order.orderedItems.find((i) => i._id.toString() === itemId);
    if (!item)
      return res
        .status(STATUS_CODE.NOT_FOUND)
        .json({ success: false, message: "Item not found in order" });

    if (item.status === "Cancelled")
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ success: false, message: "Item is already cancelled" });

    const validSizes = ["S", "M", "L", "XL", "XXL"];
    let stockUpdated = false;

    if (
      item.product &&
      item.size &&
      validSizes.includes(item.size.trim().toUpperCase())
    ) {
      const product = await Product.findById(item.product._id);
      if (product) {
        const sizeVariant = product.sizes.find(
          (s) => s.size.trim().toUpperCase() === item.size.trim().toUpperCase()
        );
        if (sizeVariant) {
          sizeVariant.stock += item.quantity;
          stockUpdated = true;
          await product.save();
        }
      }
    }

    const totalMrp = order.orderedItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );
    const paidAmount = order.finalAmount;

    const itemMrpTotal = item.price * item.quantity;
    const itemRefundAmount = (itemMrpTotal / totalMrp) * paidAmount;

    let refundProcessed = false;

    if (order.isPaid) {
      await logWalletTransaction(
        userId,
        TransactionTypes.CREDIT,
        Math.round(itemRefundAmount),
        WalletSources.ORDER_REFUND,
        `${order.orderId}-item-${itemId}`
      );
      refundProcessed = true;
    }

    item.status = "Cancelled";
    item.refundedAmount = itemRefundAmount;
    item.isRefunded = refundProcessed;

    order.refundedAmount = (order.refundedAmount || 0) + itemRefundAmount;
    const allItemsCancelled = order.orderedItems.every(
      (i) => i.status === "Cancelled"
    );
    order.status = allItemsCancelled ? "Cancelled" : "Partially Cancelled";
    order.isFullyRefunded = allItemsCancelled && order.isPaid;

    await order.save();

    return res.status(STATUS_CODE.OK).json({
      success: true,
      message: `Item cancelled successfully${refundProcessed ? " and refund processed" : ""
        }`,
      orderStatus: order.status,
    });
  } catch (error) {
    next(error);
  }
};

const returnOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { itemId, reason } = req.body;
    const userId = req.session.user?._id || req.session.user;

    const order = await Order.findOne({ orderId }).populate(
      "orderedItems.product"
    );
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return res.status(STATUS_CODE.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.userId.toString() !== userId.toString()) {
      console.error(`User ${userId} not authorized to return order ${orderId}`);
      return res.status(STATUS_CODE.FORBIDDEN).json({
        success: false,
        message: "You are not authorized to return this order",
      });
    }

    // Allow returns for "Delivered" or "Partially Returned" orders
    if (order.status !== "Delivered" && order.status !== "Partially Returned") {
      console.error(
        `Order ${orderId} cannot be returned in status ${order.status}`
      );
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message:
          "Order must be in Delivered or Partially Returned status to request a return",
      });
    }

    // Check return window (7 days, matching frontend logic)
    const deliveredDate = order.updatedAt; // Ideally, use a deliveredAt field
    const daysSinceDelivery = Math.floor(
      (new Date() - new Date(deliveredDate)) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceDelivery > 7) {
      console.error(
        `Return window expired for order ${orderId}. Delivered ${daysSinceDelivery} days ago.`
      );
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: "Return window has expired (7 days after delivery)",
      });
    }

    const item = order.orderedItems.find((i) => i._id.toString() === itemId);
    if (!item) {
      console.error(`Item ${itemId} not found in order ${orderId}`);
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: "Item not found in order",
      });
    }

    if (item.returnStatus === "Requested") {
      console.log(
        `Return already requested for item ${itemId} in order ${orderId}`
      );
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: "Return request already submitted for this item",
      });
    }

    if (item.returnStatus === "Returned") {
      console.log(`Item ${itemId} in order ${orderId} already returned`);
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: "Item has already been returned",
      });
    }

    // Update item with return request
    item.returnReason = reason;
    item.returnRequestedAt = new Date();
    item.returnStatus = "Requested";

    // Update order status
    const hasOtherReturnedItems = order.orderedItems.some(
      (i) =>
        (i.returnStatus === "Returned" || i.returnStatus === "Requested") &&
        i._id.toString() !== itemId
    );
    if (hasOtherReturnedItems) {
      order.status = "Partially Returned"; // Already in this state, but ensuring consistency
    } else {
      order.status = "Return Request";
    }

    await order.save();
    console.log(`Return requested for item ${itemId} in order ${orderId}`);

    res.status(STATUS_CODE.OK).json({
      success: true,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    next(error);
  }
};

const retryCheckout = async (req, res, next) => {
  try {
    const { productId, size, buyNow } = req.body;

    if (buyNow === "true" && (!productId || !size)) {
      return res.redirect("/");
    }

    const query = new URLSearchParams({
      buyNow,
      ...(buyNow === "true" && { productId, size }),
    });

    return res.redirect(`/checkout?${query.toString()}`);
  } catch (error) {
    next(error);
  }
};

const downloadInvoice = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId })
      .populate("orderedItems.product")
      .populate("selectedAddress");

    if (!order) {
      return res.status(STATUS_CODE.NOT_FOUND).send("Order not found");
    }

    // Create a new PDF document
    const doc = new PDFDocument({ margin: 50 });
    const filename = `invoice_${order.orderId}.pdf`;

    // Set response headers for PDF download
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    // Pipe the PDF to the response
    doc.pipe(res);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const invoiceNo = order.invoiceNo || `INV-${order.orderId}`;

    // `returnStatus` is set by the return-request/approval flow and is more
    // current than `status` for items that have been returned or have a
    // pending return request, so prefer it when present.
    const getItemDisplayStatus = (item) => {
      if (item.returnStatus === "Returned") return "Returned";
      if (item.returnStatus === "Requested") return "Return Requested";
      return item.status || "N/A";
    };

    // ---------- Header ----------
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor("#1a1a1a")
      .text("18-CREW", 50, 50, { align: "left" });

    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .fillColor("#c9302c")
      .text("TAX INVOICE", 50, 50, { width: pageWidth, align: "right" });

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#1a1a1a")
      .text(`Invoice No: ${invoiceNo}`, 50, 76, { width: pageWidth, align: "right" })
      .text(`Order ID: ${order.orderId}`, 50, 89, { width: pageWidth, align: "right" })
      .text(
        `Order Date: ${new Date(order.createdOn).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`,
        50,
        102,
        { width: pageWidth, align: "right" }
      )
      .text(`Order Status: ${order.status || order.orderStatus || "N/A"}`, 50, 115, {
        width: pageWidth,
        align: "right",
      });

    doc
      .moveTo(50, 135)
      .lineTo(50 + pageWidth, 135)
      .lineWidth(0.75)
      .strokeColor("#cccccc")
      .stroke();

    doc.y = 149;

    // Customer Information
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#1a1a1a").text("Bill To", { underline: false });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    if (order.selectedAddress) {
      doc.text(`${order.selectedAddress.name || "N/A"}`);
      if (order.selectedAddress.landMark) doc.text(`${order.selectedAddress.landMark}`);
      doc.text(`${order.selectedAddress.city || ""}`);
      doc.text(`${order.selectedAddress.state || ""} - ${order.selectedAddress.pincode || ""}`);
      doc.text(`Phone: ${order.selectedAddress.mobile || "N/A"}`);
    } else {
      doc.text("Address: Not available");
    }
    doc.moveDown();

    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .lineWidth(0.75)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(0.7);

    // Ordered Items
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#1a1a1a").text("Items");
    doc.moveDown(0.5);

    // Table Header
    const tableTop = doc.y;
    doc.rect(50, tableTop, pageWidth, 22).fill("#f2f2f2");
    doc.fillColor("#1a1a1a").fontSize(9).font("Helvetica-Bold");
    doc.text("Product", 55, tableTop + 6, { width: 145 });
    doc.text("Size", 200, tableTop + 6, { width: 40, align: "center" });
    doc.text("Qty", 240, tableTop + 6, { width: 35, align: "center" });
    doc.text("Price", 280, tableTop + 6, { width: 55, align: "right" });
    doc.text("Total", 340, tableTop + 6, { width: 55, align: "right" });
    doc.text("Status", 400, tableTop + 6, { width: 70 });
    doc.text("Refund", 470, tableTop + 6, { width: 75, align: "right" });
    doc
      .lineWidth(0.75)
      .rect(50, tableTop, pageWidth, 22)
      .strokeColor("#cccccc")
      .stroke();

    // Table Rows
    doc.font("Helvetica");
    let currentY = tableTop + 22;
    const rowHeight = 20;

    order.orderedItems.forEach((item, idx) => {
      // page-break safety
      if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        currentY = 50;
      }

      if (idx % 2 === 1) {
        doc.rect(50, currentY, pageWidth, rowHeight).fill("#fafafa");
      }

      const total = item.quantity * item.price;

      doc.fillColor("#1a1a1a").fontSize(9);

      doc.text(item.product?.productName || "N/A", 55, currentY + 5, {
        width: 145,
      });

      doc.text(item.size || "N/A", 200, currentY + 5, {
        width: 40,
        align: "center",
      });

      doc.text(String(item.quantity || 1), 240, currentY + 5, {
        width: 35,
        align: "center",
      });

      doc.text(`Rs. ${item.price.toFixed(2)}`, 280, currentY + 5, {
        width: 55,
        align: "right",
      });

      doc.text(`Rs. ${total.toFixed(2)}`, 340, currentY + 5, {
        width: 55,
        align: "right",
      });

      const displayStatus = getItemDisplayStatus(item);

      if (displayStatus === "Cancelled") {
        doc.fillColor("#c9302c");
      } else if (displayStatus === "Returned") {
        doc.fillColor("#d17a00");
      } else if (displayStatus === "Return Requested") {
        doc.fillColor("#0275d8");
      } else {
        doc.fillColor("#1e7e34");
      }

      doc.text(displayStatus, 400, currentY + 5, {
        width: 70,
      });

      doc.fillColor("#1a1a1a");

      doc.text(`Rs. ${(item.refundedAmount || 0).toFixed(2)}`, 470, currentY + 5, {
        width: 75,
        align: "right",
      });

      currentY += rowHeight;
    });

    doc
      .rect(50, tableTop + 22, pageWidth, currentY - (tableTop + 22))
      .lineWidth(0.75)
      .strokeColor("#cccccc")
      .stroke();

    // ---------- Bottom section: two aligned columns ----------
    // Left column  -> Payment Details + Refund Summary
    // Right column -> Order Summary box
    // Keeping both columns side by side (instead of stacked) avoids the
    // large empty gap that shows up when one section is short.
    const bottomTop = currentY + 20;
    const leftColX = 50;
    const leftColWidth = 250;
    const summaryBoxWidth = 230;
    const summaryX = 50 + pageWidth - summaryBoxWidth;
    const summaryLabelWidth = 130;

    // ---- Right column: Order Summary ----
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#1a1a1a").text("Order Summary", summaryX, bottomTop, {
      width: summaryBoxWidth,
    });
    let summaryY = bottomTop + 20;
    doc.fontSize(10).font("Helvetica");

    const netPaid = order.finalAmount - order.refundedAmount;

    // Coupon's share of `discount` is only known for orders placed after the
    // couponDiscount field was added; older orders will just fall back to
    // showing the combined amount under "Discount".
    const couponDiscount = order.couponDiscount || 0;
    const generalDiscount = (order.discount || 0) - couponDiscount;
    const activeCouponCode = order.couponCode || order.tempCouponCode;

    const summaryRows = [["Subtotal", `Rs. ${order.totalPrice.toFixed(2)}`]];

    if (order.couponApplied && couponDiscount > 0) {
      summaryRows.push([
        activeCouponCode ? `Coupon (${activeCouponCode})` : "Coupon Discount",
        `- Rs. ${couponDiscount.toFixed(2)}`,
      ]);
      if (generalDiscount > 0) {
        summaryRows.push(["Discount", `- Rs. ${generalDiscount.toFixed(2)}`]);
      }
    } else {
      summaryRows.push(["Discount", `- Rs. ${(order.discount || 0).toFixed(2)}`]);
    }

    summaryRows.push(
      ["Amount Paid", `Rs. ${order.finalAmount.toFixed(2)}`],
      ["Refunded", `- Rs. ${order.refundedAmount.toFixed(2)}`]
    );

    summaryRows.forEach(([label, value]) => {
      doc.fillColor("#666666").text(label, summaryX, summaryY, { width: summaryLabelWidth });
      doc.fillColor("#1a1a1a").text(value, summaryX + summaryLabelWidth, summaryY, {
        width: summaryBoxWidth - summaryLabelWidth,
        align: "right",
      });
      summaryY += 16;
    });

    doc
      .moveTo(summaryX, summaryY)
      .lineTo(summaryX + summaryBoxWidth, summaryY)
      .lineWidth(0.75)
      .strokeColor("#cccccc")
      .stroke();
    summaryY += 8;

    doc.font("Helvetica-Bold").fontSize(11);
    doc.fillColor("#1a1a1a").text("Net Paid", summaryX, summaryY, { width: summaryLabelWidth });
    doc.text(`Rs. ${netPaid.toFixed(2)}`, summaryX + summaryLabelWidth, summaryY, {
      width: summaryBoxWidth - summaryLabelWidth,
      align: "right",
    });
    summaryY += 24;

    // ---- Left column: Payment Details ----
    let leftY = bottomTop;
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#1a1a1a").text("Payment Details", leftColX, leftY, {
      width: leftColWidth,
    });
    leftY += 20;
    doc.fontSize(10).font("Helvetica").fillColor("#1a1a1a");
    doc.text(`Method: ${order.paymentMethod || "N/A"}`, leftColX, leftY, { width: leftColWidth });
    leftY += 14;
    doc.text(`Status: ${order.isPaid ? "Paid" : "Not Paid"}`, leftColX, leftY, { width: leftColWidth });
    leftY += 14;
    if (order.isPaid && order.paidAt) {
      doc.text(
        `Paid On: ${new Date(order.paidAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
        })}`,
        leftColX,
        leftY,
        { width: leftColWidth }
      );
      leftY += 14;
    }
    if (order.isFullyRefunded) {
      doc.text(`Refund Status: Fully Refunded (Rs. ${order.refundedAmount.toFixed(2)})`, leftColX, leftY, {
        width: leftColWidth,
      });
      leftY += 14;
    } else if (order.refundedAmount > 0) {
      doc.text(`Refund Status: Partial Refund (Rs. ${order.refundedAmount.toFixed(2)})`, leftColX, leftY, {
        width: leftColWidth,
      });
      leftY += 14;
    }
    leftY += 12;

    // ---- Left column: Refund Summary ----
    const refundedItems = order.orderedItems.filter((item) => {
      const s = getItemDisplayStatus(item);
      return s === "Cancelled" || s === "Returned";
    });

    if (refundedItems.length > 0) {
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#1a1a1a").text("Refund Summary", leftColX, leftY, {
        width: leftColWidth,
      });
      leftY += 20;

      const returnedItems = refundedItems.filter((i) => getItemDisplayStatus(i) === "Returned");
      const cancelledItems = refundedItems.filter((i) => getItemDisplayStatus(i) === "Cancelled");

      const renderRefundGroup = (title, items) => {
        if (items.length === 0) return;
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a1a1a").text(title, leftColX, leftY, {
          width: leftColWidth,
        });
        leftY += 14;
        doc.font("Helvetica").fontSize(9.5);
        items.forEach((item) => {
          doc.fillColor("#1a1a1a").text(
            `\u2022 ${item.product?.productName || "N/A"} (${item.size || "N/A"})`,
            leftColX,
            leftY,
            { width: 175 }
          );
          doc
            .fillColor(item.status === "Cancelled" ? "#c9302c" : "#d17a00")
            .text(`Rs. ${item.refundedAmount.toFixed(2)}`, leftColX + 175, leftY, {
              width: leftColWidth - 175,
              align: "right",
            });
          doc.fillColor("#1a1a1a");
          leftY += 14;
        });
        leftY += 4;
      };

      renderRefundGroup("Returned Items", returnedItems);
      renderRefundGroup("Cancelled Items", cancelledItems);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(`Total Refunded: Rs. ${order.refundedAmount.toFixed(2)}`, leftColX, leftY, {
          width: leftColWidth,
        });
      leftY += 18;
    }

    // ---- Footer: placed right after whichever column ran longer ----
    const contentEndY = Math.max(leftY, summaryY) + 20;
    const footerY = Math.min(contentEndY, doc.page.height - doc.page.margins.bottom - 30);
    doc
      .moveTo(50, footerY)
      .lineTo(50 + pageWidth, footerY)
      .lineWidth(0.75)
      .strokeColor("#cccccc")
      .stroke();
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Thank you for shopping with 18-CREW", 50, footerY + 8, {
        width: pageWidth,
        align: "center",
      });

    // Finalize the PDF
    doc.end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loadCheckout,
  deleteProduct,
  placeOrder,
  checkStock,
  successPage,
  orderDetails,
  cancelOrder,
  returnOrder,
  checkStockBeforeCheckout,
  verifyPayment,
  failedPage,
  retryCheckout,
  downloadInvoice,
  cancelOrderItem,
};
