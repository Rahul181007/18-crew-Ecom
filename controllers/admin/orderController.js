const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const { logWalletTransaction } = require("../../utils/wallet");
const {
  WalletSources,
  TransactionTypes,
} = require("../../constants/walletConstants");

const loadOrderList = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "userId.name": { $regex: search, $options: "i" } },
        { "userId.email": { $regex: search, $options: "i" } },
      ];
    }
    const orders = await Order.find(query)
      .populate("userId", "name email")
      .populate("orderedItems.product", "productName productImage")
      .sort({ createdOn: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);
    res.render("orders", {
      orders,
      page: "orders",
      activePage: "orders",
      currentPage: parseInt(page),
      totalPages,
      statusFilter: status || "",
      searchQuery: search || "",
    });
  } catch (error) {
    next(error);
  }
};
const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = [
      "Initiated",
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Partially Cancelled",
      "Return Request",
      "Returned",
      "Partially Returned",
    ];
    if (!validStatuses.includes(status)) {
      console.error(`Invalid status: ${status}`);
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    // Find the order
    const order = await Order.findOne({ orderId }).populate(
      "orderedItems.product"
    );
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Prevent updating status if order is cancelled or fully returned
    if (["Cancelled", "Returned"].includes(order.status)) {
      console.error(`Order ${orderId} is ${order.status.toLowerCase()}`);
      return res.status(400).json({
        success: false,
        message: `Cannot update status of a ${order.status.toLowerCase()} order`,
      });
    }

    // Update order status
    order.status = status;

    // Update item statuses for non-cancelled and non-returned items
    if (["Processing", "Shipped", "Delivered"].includes(status)) {
      order.orderedItems = order.orderedItems.map((item) => {
        if (item.status !== "Cancelled" && !item.returnStatus) {
          return { ...item.toObject(), status };
        }
        return item;
      });
    }

    // For COD orders, set isPaid and paidAt when status is Delivered
    if (status === "Delivered" && order.paymentMethod === "cod") {
      order.isPaid = true;
      order.paidAt = new Date();
      console.log(
        `Updated COD order ${orderId} to isPaid: true, paidAt: ${order.paidAt}`
      );
    }

    // Update timestamp
    order.updatedAt = new Date();

    // Save the order
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error(`Error updating order ${orderId}:`, error);
    next(error);
  }
};

const loadOrderDetail = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId })
      .populate("userId", "name email")
      .populate("orderedItems.product", "productName productImage");

    if (!order) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      return next(error);
    }
    res.render("orderDetail", {
      order,
      page: "orders",
      activePage: "orders",
    });
  } catch (error) {
    next(error);
  }
};

const rejectReturn = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { itemId, rejectionReason } = req.body;

    const order = await Order.findOne({ orderId }).populate(
      "orderedItems.product"
    );
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      order.status !== "Return Request" &&
      order.status !== "Partially Returned"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Order must be in Return Request or Partially Returned status to reject",
      });
    }

    const item = order.orderedItems.find((i) => i._id.toString() === itemId);
    if (!item) {
      return res.status(400).json({
        success: false,
        message: "Item not found in order",
      });
    }

    if (item.returnStatus !== "Requested") {
      return res.status(400).json({
        success: false,
        message: "No return request found for this item",
      });
    }

    // Update item status and store rejection reason
    item.returnStatus = "Rejected";
    item.returnRejectionReason = rejectionReason;
    item.returnProcessedAt = new Date();

    // Update order status based on remaining items
    const totalItems = order.orderedItems.length;
    const returnedItems = order.orderedItems.filter(
      (i) => i.returnStatus === "Returned"
    ).length;
    const rejectedItems = order.orderedItems.filter(
      (i) => i.returnStatus === "Rejected"
    ).length;

    if (returnedItems === totalItems) {
      order.status = "Returned";
    } else if (returnedItems > 0) {
      order.status = "Partially Returned";
    } else if (rejectedItems === totalItems) {
      order.status = "Delivered";
    } else {
      order.status = "Delivered";
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Return rejected successfully",
      data: {
        orderStatus: order.status,
        rejectionReason: rejectionReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

const approveReturn = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { itemId } = req.body;

    const order = await Order.findOne({ orderId }).populate(
      "orderedItems.product"
    );
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      order.status !== "Return Request" &&
      order.status !== "Partially Returned"
    ) {
      console.error(
        `Order ${orderId} cannot be returned in status ${order.status}`
      );
      return res.status(400).json({
        success: false,
        message:
          "Order must be in Return Request or Partially Returned status to approve",
      });
    }

    const item = order.orderedItems.find((i) => i._id.toString() === itemId);
    if (!item) {
      console.error(`Item ${itemId} not found in order ${orderId}`);
      return res.status(400).json({
        success: false,
        message: "Item not found in order",
      });
    }

    if (item.returnStatus !== "Requested") {
      console.error(
        `No return request found for item ${itemId} in order ${orderId}`
      );
      return res.status(400).json({
        success: false,
        message: "No return request found for this item",
      });
    }

    // Update item status to Returned
    item.returnStatus = "Returned";
    item.returnProcessedAt = new Date();

    const product = await Product.findById(item.product._id);
    if (!product) {
      console.error(
        `Product ${item.product.productName} not found for order ${orderId}`
      );
      return res.status(400).json({
        success: false,
        message: `Product ${item.product.productName} not found`,
      });
    }

    const sizeVariant = product.sizes.find(
      (s) =>
        String(s.size).trim().toUpperCase() ===
        String(item.size).trim().toUpperCase()
    );

    if (!sizeVariant) {
      console.error(
        `Size ${item.size} not found for product ${product.productName} in order ${orderId}`
      );
      console.error(
        `Available sizes:`,
        product.sizes.map((s) => s.size)
      );
      return res.status(400).json({
        success: false,
        message: `Size ${item.size} not found for product ${product.productName}`,
      });
    }

    console.log(
      `Before update: Stock for size ${sizeVariant.size} = ${sizeVariant.stock}`
    );
    sizeVariant.stock += item.quantity;
    console.log(
      `After increment: Stock for size ${sizeVariant.size} = ${sizeVariant.stock}`
    );
    await product.save();

    const updatedProduct = await Product.findById(item.product._id);
    const updatedSizeVariant = updatedProduct.sizes.find(
      (s) =>
        String(s.size).trim().toUpperCase() ===
        String(item.size).trim().toUpperCase()
    );
    console.log(
      `After save: Stock for size ${updatedSizeVariant.size} = ${updatedSizeVariant.stock}`
    );

    let refundAmount = 0;
    if (order.isPaid) {
      const user = await User.findById(order.userId);
      if (!user) {
        console.error(
          `User ${order.userId} not found for refund in order ${orderId}`
        );
        return res.status(400).json({
          success: false,
          message: "User not found for refund",
        });
      }

      const itemTotal = item.price * item.quantity;
      refundAmount = (itemTotal / order.totalPrice) * order.finalAmount;
      if (
        order.paymentMethod === "wallet" ||
        order.paymentMethod === "razorpay"
      ) {
        await logWalletTransaction(
          user._id,
          TransactionTypes.CREDIT,
          refundAmount,
          WalletSources.ORDER_REFUND,
          order.orderId
        );

        order.refundedAmount = (order.refundedAmount || 0) + refundAmount;
        item.isRefunded = true;
        item.refundedAt = new Date();

        await Promise.all([user.save(), order.save()]);
      }
    }

    const totalItems = order.orderedItems.length;
    const returnedItems = order.orderedItems.filter(
      (i) => i.returnStatus === "Returned"
    ).length;
    if (returnedItems === totalItems) {
      console.log("1");
      order.status = "Returned";
    } else if (returnedItems > 0) {
      console.log("2");
      order.status = totalItems === 1 ? "Returned" : "Partially Returned";
    } else {
      console.log("3");
      order.status = "Delivered";
    }
    const refundableItems = order.orderedItems.filter(
      (i) => i.price > 0 && i.returnStatus === "Returned"
    );
    const allRefunded = refundableItems.every((i) => i.isRefunded);

    if (order.isPaid && allRefunded && refundableItems.length > 0) {
      order.isFullyRefunded = true;
    } else {
      order.isFullyRefunded = false;
    }

    await order.save();
    console.log(
      `Return approved for item ${itemId} in order ${orderId}. Order status: ${order.status}`
    );

    const responseData = {
      success: true,
      message: "Return approved successfully",
      data: {
        refundAmount: refundAmount.toFixed(2),
        stockUpdated: updatedSizeVariant.stock,
        orderStatus: order.status,
      },
    };
    
    res.setHeader("Content-Type", "application/json");
    res.status(200).json(responseData);
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports = {
  loadOrderList,
  updateOrderStatus,
  loadOrderDetail,
  rejectReturn,
  approveReturn,
};
