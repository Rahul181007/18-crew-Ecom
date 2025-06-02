
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product=require("../../models/productSchema")

const loadOrderList = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('userId', 'name email') 
      .populate('orderedItems.product', 'productName productImage')
      .sort({ createdOn: -1 });
    res.render('orders', { orders, page: 'orders', activePage: "orders" });
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageError");
  }
};
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
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
    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Prevent updating status if order is cancelled
    if (order.status === "Cancelled") {
      console.error(`Order ${orderId} is already cancelled`);
      return res.status(400).json({
        success: false,
        message: "Cannot update status of a cancelled order",
      });
    }

    // Update status
    order.status = status;

    // For COD orders, set isPaid and paidAt when status is Delivered
    if (status === "Delivered" && order.paymentMethod === "cod") {
      order.isPaid = true;
      order.paidAt = new Date();
      console.log(`Updated COD order ${orderId} to isPaid: true, paidAt: ${order.paidAt}`);
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
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the status",
      error: error.message,
    });
  }
};

const loadOrderDetail=async(req,res)=>{
try {
    const {orderId}=req.params;
    const order=await Order.findOne({orderId})
    .populate('userId','name email')
    .populate('orderedItems.product','productName productImage');

    if(!order){
        return res.status(404).redirect("/admin/pageError")
    }
    res.render("orderDetail",{
        order,
        page:'orders',
        activePage:'orders'
    })
} catch (error) {
    console.error("Error loading order detail:", error);
    res.status(500).render('pageError', { message: 'An error occurred while loading the order details' });
}
}
 
const rejectReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemId } = req.body;

    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "Return Request" && order.status !== "Partially Returned") {
      console.error(`Order ${orderId} cannot be processed in status ${order.status}`);
      return res.status(400).json({
        success: false,
        message: "Order must be in Return Request or Partially Returned status to reject",
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

    if (item.returnStatus !== "Requested") {
      console.error(`No return request found for item ${itemId} in order ${orderId}`);
      return res.status(400).json({
        success: false,
        message: "No return request found for this item",
      });
    }

    // Reset return details
    item.returnStatus = "Rejected";
    item.returnReason = null;
    item.returnRequestedAt = null;

    // Check return status of all items
    const allItemsReturned = order.orderedItems.every(i => i.returnStatus === "Returned");
    const someItemsReturned = order.orderedItems.some(i => i.returnStatus === "Returned");
    order.status = allItemsReturned ? "Returned" : someItemsReturned ? "Partially Returned" : "Delivered";

    await order.save();
    console.log(`Return rejected for item ${itemId} in order ${orderId}. Order status: ${order.status}`);

    res.status(200).json({
      success: true,
      message: "Return rejected successfully",
      data: {
        orderStatus: order.status,
        allItemsReturned,
        someItemsReturned,
      },
    });
  } catch (error) {
    console.error("Error rejecting return:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while rejecting the return",
    });
  }
};


const approveReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemId } = req.body;

    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "Return Request" && order.status !== "Partially Returned") {
      console.error(`Order ${orderId} cannot be returned in status ${order.status}`);
      return res.status(400).json({
        success: false,
        message: "Order must be in Return Request or Partially Returned status to approve",
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

    if (item.returnStatus !== "Requested") {
      console.error(`No return request found for item ${itemId} in order ${orderId}`);
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
      console.error(`Product ${item.product.productName} not found for order ${orderId}`);
      return res.status(400).json({
        success: false,
        message: `Product ${item.product.productName} not found`,
      });
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

    console.log(`Before update: Stock for size ${sizeVariant.size} = ${sizeVariant.stock}`);
    sizeVariant.stock += item.quantity;
    console.log(`After increment: Stock for size ${sizeVariant.size} = ${sizeVariant.stock}`);
    await product.save();

    const updatedProduct = await Product.findById(item.product._id);
    const updatedSizeVariant = updatedProduct.sizes.find(s =>
      String(s.size).trim().toUpperCase() === String(item.size).trim().toUpperCase()
    );
    console.log(`After save: Stock for size ${updatedSizeVariant.size} = ${updatedSizeVariant.stock}`);

    let refundAmount = 0;
    if (order.isPaid) {
      const user = await User.findById(order.userId);
      if (!user) {
        console.error(`User ${order.userId} not found for refund in order ${orderId}`);
        return res.status(400).json({
          success: false,
          message: "User not found for refund",
        });
      }

      const itemTotal = item.price * item.quantity;
      refundAmount = (itemTotal / order.totalPrice) * order.finalAmount;
if (order.paymentMethod === "wallet" || order.paymentMethod === "razorpay") {
  user.wallet = (user.wallet || 0) + refundAmount;

  user.walletTransactions = user.walletTransactions || [];
  user.walletTransactions.push({
    type: "credit",
    amount: refundAmount,
    source: "Return Refund",
    reference: order.orderId,
    date: new Date()
  });

  order.refundedAmount = (order.refundedAmount || 0) + refundAmount;
  item.isRefunded = true;
  item.refundedAt = new Date();

  await Promise.all([user.save(), order.save()]);
}

    }

    const totalItems=order.orderedItems.length;
    const returnedItems=order.orderedItems.filter(i=>i.returnStatus==="Returned").length
    if(returnedItems===totalItems){
      console.log("1");
      order.status="Returned"
    }else if(returnedItems>0){
      console.log("2")
      order.status=totalItems===1?"Returned":"Partially Returned";
    }else{
      console.log("3")
      order.status="Delivered"
    }
    const refundableItems = order.orderedItems.filter(i => i.price > 0 && i.returnStatus === "Returned");
const allRefunded = refundableItems.every(i => i.isRefunded);

if (order.isPaid && allRefunded && refundableItems.length > 0) {
  order.isFullyRefunded = true;
} else {
  order.isFullyRefunded = false;
}

    await order.save();
    console.log(`Return approved for item ${itemId} in order ${orderId}. Order status: ${order.status}`);

    const responseData = {
      success: true,
      message: "Return approved successfully",
      data: {
        refundAmount: refundAmount.toFixed(2),
        stockUpdated: updatedSizeVariant.stock,
        orderStatus: order.status,
       
      },
    };
    console.log('Sending response:', responseData);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error approving return:", error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      success: false,
      message: "An error occurred while approving the return",
    });
  }
};


module.exports = {
  loadOrderList,
  updateOrderStatus,
  loadOrderDetail,
  rejectReturn,
  approveReturn
};
