const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema")
const { isValidObjectId } = mongoose;
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
})
const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user || req.session.user._id;
    const { productId, size, buyNow, orderId } = req.query;
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
    let discount = 0;
    let couponDiscount = 0;
    let couponCode = null;
    let buyNowData = null;
    let subtotal = 0;

    const applyGeneralDiscount = (total) => {
      return total * 0.1; // Example: 10% off
    };

    // Handle retry flow for existing order
    if (orderId && isValidObjectId(orderId)) {
      console.log("Entering retry flow for orderId:", orderId);
      const order = await Order.findById(orderId).populate("orderedItems.product");
      if (!order || order.userId.toString() !== userId.toString()) {
        console.log("Order not found or unauthorized:", orderId);
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
          (s) => String(s.size).trim().toLowerCase() === String(item.size).trim().toLowerCase()
        );
        if (!sizeVariant || sizeVariant.stock < item.quantity) {
          console.log("Insufficient stock for retry:", item.productId, item.size);
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
          (s) => String(s.size).trim().toLowerCase() === String(size).trim().toLowerCase()
        );

        if (!sizeVariant || sizeVariant.stock < 1) {
          console.log("Size not found or out of stock:", size, productId);
          return res.redirect("/shop");
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
        discount = applyGeneralDiscount(subtotal);
        grandTotal = subtotal - discount - couponDiscount;
        buyNowData = { productId, size };
      } else {
        // Existing cart flow
        console.log("Entering Cart flow");
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
          console.log("Cart is empty for user:", userId);
          return res.redirect("/shop");
        }

        for (const item of cart.items) {
          const product = await Product.findById(item.productId._id);
          const sizeVariant = product.sizes.find(
            (s) => String(s.size).trim().toLowerCase() === String(item.size).trim().toLowerCase()
          );
          if (!sizeVariant || sizeVariant.stock < item.quantity) {
            console.log("Insufficient stock for cart item:", item.productId._id, item.size);
            return res.redirect("/shop");
          }
        }

        products = cart.items.map((item) => ({
          ...item.toObject(),
          productDetails: item.productId,
        }));

        subtotal = products.reduce((sum, item) => {
          return sum + item.quantity * item.productDetails.salePrice;
        }, 0);

        discount = applyGeneralDiscount(subtotal);
        grandTotal = subtotal - discount - couponDiscount;
      }
    }

    // Find valid coupons
    const today = new Date();
    const findCoupons = await Coupon.find({
      isActive: true,
      createdOn: { $lt: today },
      expireOn: { $gt: today },
      minimumPrice: { $lt: grandTotal + discount },
    });
    console.log("Available coupons", findCoupons);

    // Store coupon in session if retrying
    if (couponCode) {
      req.session.appliedCoupon = { couponId: couponCode, discount: couponDiscount };
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
      wishlistCount: findUser.wishlist?.length || 0,
      buyNowData,
      orderId: orderId || null,
    });

  } catch (error) {
    console.error("Checkout error:", error);
    res.redirect("/pageNotFound");
  }
};


// const loadCheckout = async (req, res) => {
//   try {
//     const userId = req.session.user || req.session.user._id;
//     const { productId, size, buyNow, orderId } = req.query;
//     console.log("Query parameters:", req.query);

//     if (!userId) {
//       console.log("No userId in session");
//       return res.redirect("/signin");
//     }

//     const findUser = await User.findById(userId);
//     if (!findUser) {
//       console.log("User not found:", userId);
//       return res.redirect("/shop");
//     }

//     const addressData = await Address.findOne({ userId });

//     let products = [];
//     let grandTotal = 0;
//     let isCart = true;
//     let discount = 0;
//     let couponDiscount = 0;
//     let couponCode = null;
//     let buyNowData = null;
//     let subtotal = 0
//     const applyGeneralDiscount = (total) => {
//       return total * 0.1; // Example: 10% off
//     };

//     // Handle retry flow for existing order
//     if (orderId && isValidObjectId(orderId)) {
//       console.log("Entering retry flow for orderId:", orderId);
//       const order = await Order.findById(orderId).populate("orderedItems.product");
//       if (!order || order.userId.toString() !== userId.toString()) {
//         console.log("Order not found or unauthorized:", orderId);
//         return res.redirect("/shop");
//       }

//       console.log("1")

//       if (order.isPaid) {
//         console.log("Order already paid:", orderId);
//         return res.redirect(`/successPage?id=${orderId}`);
//       }
//       console.log("2")
//       isCart = order.orderedItems.length > 1 || !buyNow;
//       products = order.orderedItems.map((item) => ({
//         productId: item.product._id,
//         productDetails: item.product,
//         quantity: item.quantity,
//         size: item.size,
//         price: item.price,
//       }));
//       console.log("3")

//       subtotal = order.finalAmount + order.discount + (order.couponDiscount || 0);
//       couponDiscount = order.couponCode ? order.couponDiscount : 0;
//       couponCode = order.tempCouponCode || order.couponCode;

//       discount = applyGeneralDiscount(subtotal);
//       grandTotal = subtotal - discount - couponDiscount;

//       if (buyNow && productId && size) {
//         buyNowData = { productId, size };
//       }
//       console.log("4")
//       // Verify stock for retry
//       for (const item of products) {
//         const product = await Product.findById(item.productId);
//         const sizeVariant = product.sizes.find(
//           (s) => String(s.size).trim().toLowerCase() === String(item.size).trim().toLowerCase()
//         );
//         if (!sizeVariant || sizeVariant.stock < item.quantity) {
//           console.log("Insufficient stock for retry:", item.productId, item.size);
//           return res.redirect("/shop");
//         }
//         console.log("5")
//       }
//     } else {
//       // Existing buy-now flow

//       if (buyNow && productId && size) {
//         console.log("Entering Buy Now flow");
//         isCart = false;

//         const product = await Product.findById(productId);
//         if (!product) {
//           console.log("Product not found for buy now:", productId);
//           return res.redirect("/shop");
//         }

//         const sizeVariant = product.sizes.find(
//           (s) => String(s.size).trim().toLowerCase() === String(size).trim().toLowerCase()
//         );

//         if (!sizeVariant || sizeVariant.stock < 1) {
//           console.log("Size not found or out of stock:", size, productId);
//           return res.redirect("/shop");
//         }

//         products = [
//           {
//             productId: product._id,
//             productDetails: product,
//             quantity: 1,
//             size: size,
//             price: product.salePrice,
//           },
//         ];

//         subtotal = product.salePrice;
//         discount = applyGeneralDiscount(subtotal);
//         grandTotal = subtotal - discount - couponDiscount;
//         buyNowData = { productId, size };
//       } else {
//         // Existing cart flow
//         console.log("Entering Cart flow");
//         const cart = await Cart.findOne({ userId }).populate("items.productId");
//         if (!cart || cart.items.length === 0) {
//           console.log("Cart is empty for user:", userId);
//           return res.redirect("/shop");
//         }

//         for (const item of cart.items) {
//           const product = await Product.findById(item.productId._id);
//           const sizeVariant = product.sizes.find(
//             (s) => String(s.size).trim().toLowerCase() === String(item.size).trim().toLowerCase()
//           );
//           if (!sizeVariant || sizeVariant.stock < item.quantity) {
//             console.log("Insufficient stock for cart item:", item.productId._id, item.size);
//             return res.redirect("/shop");
//           }
//         }

//         products = cart.items.map((item) => ({
//           ...item.toObject(),
//           productDetails: item.productId,
//         }));


//         subtotal = products.reduce((sum, item) => {
//           return sum + item.quantity * item.productDetails.salePrice;
//         }, 0);

//         discount = applyGeneralDiscount(subtotal);
//         grandTotal = subtotal - discount - couponDiscount;
//       }
//     }

//     // Find valid coupons
//     const today = new Date();
//     const findCoupons = await Coupon.find({
//       isActive: true,
//       createdOn: { $lt: today },
//       expireOn: { $gt: today },
//       minimumPrice: { $lt: grandTotal + discount },
//     });
//     console.log("Avaiable coupons".findCoupons)

//     // Store coupon in session if retrying
//     if (couponCode) {
//       req.session.appliedCoupon = { couponId: couponCode, discount: couponDiscount };
//     }
//     console.log({
//       subtotal,
//       discount,
//       couponDiscount,
//       grandTotal,
//       isCart,
//       products,
//     });
//     res.render("checkoutPage", {
//       product: products,
//       user: findUser,
//       isCart,
//       userAddress: addressData,
//       subtotal,
//       grandTotal,
//       discount,
//       couponDiscount,
//       Coupon: findCoupons,
//       cartCount: isCart ? products.length : 0,
//       wishlistCount: findUser.wishlist?.length || 0,
//       buyNowData,
//       orderId: orderId || null,
//     });
//   } catch (error) {
//     console.error("Checkout error:", error);
//     res.redirect("/pageNotFound");
//   }
// };

const checkStockBeforeCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    console.log(userId)
    if (!userId) {
      return res.status(401).json({ success: false, message: "Please signin proceed" });
    }
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "your cart is empty" });
    }
    const outOfStockItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product) {
        outOfStockItems.push({ productName: 'Unknown Product', size: item.size });
        continue;
      }
      const sizeVariant = product.sizes.find(s =>
        String(s.size).trim().toLowerCase() === String(item.size).trim().toLowerCase()
      );
      if (!sizeVariant || sizeVariant.stock < item.quantity) {
        outOfStockItems.push({
          productName: product.productName,
          size: item.size,
          availableStock: sizeVariant ? sizeVariant.stock : 0,
          requestedQuantity: item.quantity
        })
      }
    }
    if (outOfStockItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items in your cart are out of stock or have insufficient quantity.",
        outOfStockItems
      })
    }
    return res.status(200).json({ success: true, message: "All items are in stock. Proceeding to checkout." });
  } catch (error) {
    console.error("Stock check error:", error);
    return res.status(500).json({ success: false, message: "An error occurred while checking stock." });
  }
}

const deleteProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const cartIndex = user.cart.findIndex((item) => item.productId == id);
    user.cart.splice(cartIndex, 1);
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


    const userId = req.session.user?._id;
    console.log(userId)

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

const generateRazorpayOrder = async (orderId, amount) => {
  const options = {
    amount: amount * 100, 
    currency: 'INR',
    receipt: orderId ? `order_${orderId}` : `temp_${Date.now()}`,
  };
  const razorpayOrder = await razorpay.orders.create(options);
  if (!razorpayOrder.id) {
    throw new Error('Failed to create Razorpay order');
  }
  return razorpayOrder;
};

// const placeOrder = async (req, res) => {
//   try {
//     const {
//       totalPrice,
//       finalAmount,
//       addressId,
//       addressIndex = 0,
//       payment,
//       generalDiscount = 0,
//       couponDiscount = 0,
//       couponCode,
//       buyNow,
//       productId,
//       size,
//       quantities,
//     } = req.body;

//     const userId = req.session.user || req.session.user._id;
//     const isBuyNowOrder = buyNow === 'true' || buyNow === true;

//     if (!totalPrice || !addressId || !payment) {
//       return res.status(400).json({ status: false, message: "Missing fields" });
//     }

//     const validPayments = ['cod', 'wallet', 'razorpay'];
//     if (!validPayments.includes(payment)) {
//       return res.status(400).json({ status: false, message: "Invalid payment method" });
//     }

//     const address = await Address.findOne({ _id: addressId, userId });
//     if (!address || !address.address?.[addressIndex]) {
//       return res.status(400).json({ status: false, message: "Invalid address" });
//     }

//     let orderedItems = [];

//     // ✅ Prepare items (no stock changes yet)
//     if (isBuyNowOrder) {
//       const product = await Product.findById(productId);
//       if (!product) return res.status(404).json({ status: false, message: "Product not found" });

//       const sizeVariant = product.sizes.find(
//         (s) => String(s.size).toUpperCase() === String(size).toUpperCase()
//       );
//       if (!sizeVariant || sizeVariant.stock < 1) {
//         return res.status(400).json({ status: false, message: "Out of stock" });
//       }

//       orderedItems.push({
//         product: productId,
//         quantity: 1,
//         price: product.salePrice,
//         size,
//       });
//     } else {
//       const cart = await Cart.findOne({ userId }).populate('items.productId');
//       if (!cart || cart.items.length === 0) {
//         return res.status(400).json({ status: false, message: "Cart empty" });
//       }

//       for (const item of cart.items) {
//         const product = item.productId;
//         const quantity = quantities?.[product._id] || item.quantity;
//         const sizeVariant = product.sizes.find(
//           (s) => String(s.size).toUpperCase() === String(item.size).toUpperCase()
//         );

//         if (!sizeVariant || sizeVariant.stock < quantity) {
//           return res.status(400).json({ status: false, message: `${product.productName} size ${item.size} is out of stock` });
//         }

//         orderedItems.push({
//           product: product._id,
//           quantity,
//           price: product.salePrice,
//           size: item.size,
//         });
//       }
//     }

//     // ✅ Create order with status 'Initiated' for Razorpay
//     const order = new Order({
//       userId,
//       orderedItems,
//       totalPrice,
//       discount: generalDiscount + couponDiscount,
//       finalAmount,
//       selectedAddress: address.address[addressIndex],
//       paymentMethod: payment,
//       isPaid: payment !== 'razorpay',
//       couponApplied: !!couponCode,
//       tempCouponCode: couponCode || null,
//       status: payment === 'razorpay' ? 'Initiated' : 'Pending',
//       isBuyNowOrder,
//     });

//     await order.save();

//     // Wallet payment handling
//     if (payment === 'wallet') {
//       const user = await User.findById(userId);
//       if (user.walletBalance < finalAmount) {
//         return res.status(400).json({ status: false, message: "Insufficient wallet balance" });
//       }
//       user.walletBalance -= finalAmount;
//       await user.save();
//     }

//     // COD and Wallet → stock deduction
//     if (payment !== 'razorpay') {
//       for (const item of orderedItems) {
//         const product = await Product.findById(item.product);
//         const sizeVariant = product.sizes.find(
//           (s) => String(s.size).toUpperCase() === String(item.size).toUpperCase()
//         );
//         sizeVariant.stock -= item.quantity;
//         await product.save();
//       }

//       if (!isBuyNowOrder) {
//         await Cart.findOneAndUpdate({ userId }, { $set: { items: [], couponApplied: null } });
//       }

//       req.session.appliedCoupon = null;
//     }

//     if (payment === 'razorpay') {
//       const razorpayOrder = await generateRazorpayOrder(order._id, finalAmount);
//       return res.status(200).json({
//         status: true,
//         order,
//         razorpayOrder,
//         message: "Razorpay order created",
//       });
//     }

//     return res.status(200).json({
//       status: true,
//       order,
//       message: "Order placed successfully",
//     });

//   } catch (err) {
//     console.error("placeOrder error:", err);
//     return res.status(500).json({ status: false, message: "Internal server error" });
//   }
// };


// const verifyPayment = async (req, res) => {
//   try {
//     const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

//     const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
//     hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
//     const generatedSignature = hmac.digest("hex");

//     if (generatedSignature !== razorpay_signature) {
//       // ❌ Invalid payment → delete temporary order
//       await Order.findByIdAndDelete(orderId);

//       return res.status(400).json({
//         status: false,
//         message: "Invalid payment signature",
//         redirect: `/failedPage?id=${orderId}&message=${encodeURIComponent("Invalid payment signature")}`,
//       });
//     }

//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({
//         status: false,
//         message: "Order not found",
//         redirect: `/failedPage?id=${orderId}&message=${encodeURIComponent("Order not found")}`,
//       });
//     }

//     if (order.isPaid) {
//       return res.status(200).json({
//         status: true,
//         message: "Order already paid",
//         orderId: order._id,
//       });
//     }



//     for (const item of order.orderedItems) {
//       const product = await Product.findById(item.product);
//       const sizeVariant = product.sizes.find(
//         (s) => String(s.size).toUpperCase() === String(item.size).toUpperCase()
//       );
//       sizeVariant.stock -= item.quantity;
//       await product.save();
//     }

//     // ✅ Apply coupon
//     if (order.tempCouponCode) {
//       const coupon = await Coupon.findOne({ name: order.tempCouponCode });
//       if (coupon) {
//         coupon.usedBy.push({
//           userId: order.userId,
//           usageDate: new Date(),
//         });
//         await coupon.save();
//         order.couponCode = order.tempCouponCode;
//         order.tempCouponCode = null;
//       }
//     }

//     // ✅ Mark as paid and update status
//     order.isPaid = true;
//     order.status = 'Pending';
//     order.paymentMethod = "razorpay";
//     order.razorpayDetails = {
//       paymentId: razorpay_payment_id,
//       orderId: razorpay_order_id,
//       signature: razorpay_signature,
//     };
//     order.paidAt = new Date();
//     await order.save();

//     // ✅ Clear cart
//     if (!order.isBuyNowOrder) {
//       await Cart.findOneAndUpdate({ userId: order.userId }, { $set: { items: [], couponApplied: null } });
//     }

//     req.session.appliedCoupon = null;

//     return res.status(200).json({
//       status: true,
//       message: "Payment verified successfully",
//       orderId: order._id,
//     });

//   } catch (error) {
//     console.error("verifyPayment error:", error);
//     return res.status(500).json({
//       status: false,
//       message: "Payment verification failed",
//       redirect: `/failedPage?id=${req.body.orderId}&message=${encodeURIComponent("Payment verification failed")}`,
//     });
//   }
// };


// const failedPage = async (req, res) => {
//   try {
//     const { id: orderId, message } = req.query;
//      console.log(req.query);
//     if (!req.session.user) {
//       console.log("No user in session");
//       return res.redirect("/signin");
//     }

//     if (!orderId || !isValidObjectId(orderId)) {
//       console.log("Invalid or missing orderId:", orderId);
//       return res.status(400).render("failedPage", {
//         message: "Invalid order ID",
//         orderId: null,
//         user: req.session.user,
//       });
//     }

//     const order = await Order.findOne({ _id: orderId, userId: req.session.user }).populate("orderedItems.product");
//     if (!order) {
//       console.log("Order not found for orderId:", orderId);
//       return res.status(404).render("failedPage", {
//         message: "Order not found",
//         orderId: null,
//         user: req.session.user,
//       });
//     }

//     if (!order.orderedItems || order.orderedItems.length === 0) {
//       console.log("Order has no items:", orderId);
//       return res.status(400).render("failedPage", {
//         message: "Order has no items",
//         orderId: null,
//         user: req.session.user,
//       });
//     }

//     // Determine if this is a Buy Now order (1 item) or Cart order (multiple items)
//     const isBuyNow = order.orderedItems.length === 1;
//     let productId, size;

//     if (isBuyNow) {
//       // For Buy Now, extract productId and size from the single item
//       productId = order.orderedItems[0]?.product?._id?.toString();
//       size = order.orderedItems[0]?.size;

//       if (!productId || !size) {
//         console.log("Missing productId or size in Buy Now order:", orderId);
//         return res.status(400).render("failedPage", {
//           message: "Invalid Buy Now order details",
//           orderId: null,
//           user: req.session.user,
//         });
//       }
//     }

//     res.render("failedPage", {
//       message: message || "Payment failed. Please try again.",
//       orderId,
//       productId: isBuyNow ? productId : null, 
//       size: isBuyNow ? size : null,           
//       isBuyNow,                              
//     });
//   } catch (error) {
//     console.error( "Error in failedPage controller:", error);
//     res.status(500).redirect("/pageNotFound");
//   }
// };

const placeOrder = async (req, res) => {
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

    const userId = req.session.user|| req.session.user._id;
    if (!userId) {
      return res.status(401).json({ status: false, message: "User not authenticated" });
    }

    const isBuyNowOrder = buyNow === 'true' || buyNow === true;

    if (!totalPrice || !addressId || !payment) {
      return res.status(400).json({ status: false, message: "Missing fields" });
    }

    const validPayments = ['cod', 'wallet', 'razorpay'];
    if (!validPayments.includes(payment)) {
      return res.status(400).json({ status: false, message: "Invalid payment method" });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address || !address.address?.[addressIndex]) {
      return res.status(400).json({ status: false, message: "Invalid address" });
    }

    let orderedItems = [];

    // Prepare items (no stock changes yet)
    if (isBuyNowOrder) {
      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ status: false, message: "Product not found" });

      const sizeVariant = product.sizes.find(
        (s) => String(s.size).toUpperCase() === String(size).toUpperCase()
      );
      if (!sizeVariant || sizeVariant.stock < 1) {
        return res.status(400).json({ status: false, message: "Out of stock" });
      }

      orderedItems.push({
        product: productId,
        quantity: 1,
        price: product.salePrice,
        size,
      });
    } else {
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ status: false, message: "Cart empty" });
      }

      for (const item of cart.items) {
        const product = item.productId;
        const quantity = quantities?.[product._id] || item.quantity;
        const sizeVariant = product.sizes.find(
          (s) => String(s.size).toUpperCase() === String(item.size).toUpperCase()
        );

        if (!sizeVariant || sizeVariant.stock < quantity) {
          return res.status(400).json({ status: false, message: `${product.productName} size ${item.size} is out of stock` });
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
      finalAmount,
      selectedAddress: address.address[addressIndex],
      paymentMethod: payment,
      isPaid: payment !== 'razorpay',
      couponApplied: !!couponCode,
      couponCode:payment==='razorpay'?null:couponCode,
      tempCouponCode:payment==='razorpay'?couponCode:null,
      status: payment === 'razorpay' ? 'Initiated' : 'Pending',
      isBuyNowOrder,
    };
  

    if (payment === 'razorpay') {
      // Store order details in session for Razorpay
      req.session.tempOrder = { ...orderData, addressId, addressIndex };
      const razorpayOrder = await generateRazorpayOrder(Date.now().toString(), finalAmount); // Use temporary ID
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
    if (payment === 'wallet') {
      const user = await User.findById(userId);
      if (user.walletBalance < finalAmount) {
        await Order.findByIdAndDelete(order._id); // Rollback order
        return res.status(400).json({ status: false, message: "Insufficient wallet balance" });
      }
      user.walletBalance -= finalAmount;
      await user.save();
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

    // Clear cart for non-Buy Now orders
    if (!isBuyNowOrder) {
      await Cart.findOneAndUpdate({ userId }, { $set: { items: [], couponApplied: null } });
    }

    req.session.appliedCoupon = null;

    return res.status(200).json({
      status: true,
      order,
      message: "Order placed successfully",
    });

  } catch (err) {
    console.error("placeOrder error:", err);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Invalid payment, no order saved
      return res.status(400).json({
        status: false,
        message: "Invalid payment signature",
        redirect: `/failedPage?message=${encodeURIComponent("Invalid payment signature")}`,
      });
    }

    // Retrieve temp order from session
    const tempOrder = req.session.tempOrder;
    if (!tempOrder) {
      return res.status(400).json({
        status: false,
        message: "No pending order found",
        redirect: `/failedPage?message=${encodeURIComponent("No pending order found")}`,
      });
    }

    // Validate stock again before saving
    for (const item of tempOrder.orderedItems) {
      const product = await Product.findById(item.product);
      const sizeVariant = product.sizes.find(
        (s) => String(s.size).toUpperCase() === String(item.size).toUpperCase()
      );
      if (!sizeVariant || sizeVariant.stock < item.quantity) {
        return res.status(400).json({
          status: false,
          message: `${product.productName} size ${item.size} is out of stock`,
          redirect: `/failedPage?message=${encodeURIComponent(`${product.productName} size ${item.size} is out of stock`)}`,
        });
      }
    }

    // Save order to database
    const order = new Order({
      ...tempOrder,
      isPaid: true,
      status: 'Pending',
      paymentMethod: 'razorpay',
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
      console.log("hello",coupon)
      if (coupon) {
        coupon.usedBy.push({
          userId: order.userId,
          usageDate: new Date(),
        });
        await coupon.save();
        order.couponCode = order.tempCouponCode;
        order.tempCouponCode = null;
        await order.save();
      }
    }

    // Clear cart for non-Buy Now orders
    if (!order.isBuyNowOrder) {
      await Cart.findOneAndUpdate({ userId: order.userId }, { $set: { items: [], couponApplied: null } });
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
      redirect: `/failedPage?message=${encodeURIComponent("Payment verification failed")}`,
    });
  }
};
const failedPage = async (req, res) => {
  try {
    const { message } = req.query;

    if (!req.session.user) {
      console.log("No user in session");
      return res.redirect("/signin");
    }

    const tempOrder = req.session.tempOrder;
    if (!tempOrder || tempOrder.paymentMethod !== 'razorpay') {
      return res.status(400).render("failedPage", {
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
        return res.status(400).render("failedPage", {
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
    });
  } catch (error) {
    console.error("Error in failedPage controller:", error);
    res.status(500).redirect("/pageNotFound");
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

const retryCheckout = async (req, res) => {
  try {
    const { productId, size, buyNow } = req.body;

    if (buyNow === 'true' && (!productId || !size)) {
      return res.redirect('/');
    }

    const query = new URLSearchParams({
      buyNow,
      ...(buyNow === 'true' && { productId, size }),
    });

    return res.redirect(`/checkout?${query.toString()}`);
  } catch (err) {
    console.error('Retry Checkout Error:', err);
    return res.redirect('/');
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
  retryCheckout
}