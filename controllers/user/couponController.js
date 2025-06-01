const Coupon = require("../../models/couponSchema");
const Order=require("../../models/orderSchema")
const applyCoupon = async (req, res) => {
  try {
    const { couponCode, cartTotal } = req.body;
    console.log(couponCode)
    const userId = req.session.user || req.session.user._id;

    const coupon = await Coupon.findOne({ name: couponCode.toUpperCase(), isActive: true });

    if (!coupon) {
      return res.status(400).json({ status: false, message: "Invalid coupon code" });
    }

    if (coupon.expireOn && coupon.expireOn < new Date()) {
      return res.status(400).json({ status: false, message: "Coupon has expired" });
    }

    if (coupon.maxUsage && coupon.usedBy.length >= coupon.maxUsage) {
      return res.status(400).json({ status: false, message: "Coupon usage limit reached" });
    }

    const userUsedInPaidOrder = await Order.findOne({
      userId,
      couponCode: coupon.name,
      isPaid: true,
    });

    if (userUsedInPaidOrder) {
      return res.status(400).json({ status: false, message: "You have already used this coupon" });
    }

    if (cartTotal < coupon.minimumPrice) {
      return res.status(400).json({
        status: false,
        message: `Minimum order amount is ₹${coupon.minimumPrice}`,
      });
    }

 
    let discount = 0;
    if (coupon.discountType === 'price') {
      discount = coupon.offerPrice || 0;
    } else if (coupon.discountType === 'percentage') {
      discount = ((coupon.offerPercentage / 100) * cartTotal);
    }

    // Cap the discount if it exceeds cartTotal
    if (discount > cartTotal) discount = cartTotal;
    req.session.appliedCoupon = {
      code: coupon.name,
      couponId: coupon._id,  // Store coupon ID for later reference
      discount: parseFloat(discount.toFixed(2))
    };

    return res.status(200).json({
      status: true,
      message: "Coupon applied successfully",
      discount: parseFloat(discount.toFixed(2)),
    });

  } catch (error) {
    console.error("Coupon validation error:", error);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

const removeCoupon = async (req, res) => {
    try {
        if (!req.session.appliedCoupon) {
            return res.status(400).json({
                status: false,
                message: "No coupon applied"
            });
        }

        req.session.appliedCoupon = null;
        return res.status(200).json({
            status: true,
            message: "Coupon removed successfully"
        });
    } catch (error) {
        console.error('Coupon remove error:', error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    applyCoupon,
    removeCoupon
};
