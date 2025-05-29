const Coupon = require("../../models/couponSchema");

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartTotal } = req.body;
        const userId = req.session.user?._id;


        if (!couponCode?.trim()) {
            return res.status(400).json({ status: false, message: "Coupon code is required" });
        }

        if (isNaN(cartTotal)) {
            return res.status(400).json({ status: false, message: "Invalid cart total" });
        }

        if (req.session.appliedCoupon) {
            return res.status(400).json({
                status: false,
                message: 'A coupon is already applied'
            });
        }

        const coupon = await Coupon.findOne({ name: couponCode });
        if (!coupon) {
            return res.status(404).json({ status: false, message: "Coupon not found" });
        }
 
        const now = new Date();
        const errors = [];

        if (!coupon.islist) errors.push("Coupon is not active");
        if (coupon.expireOn < now) errors.push("Coupon expired");

       
        if (coupon.usedBy.some(entry => entry.userId.toString() === userId.toString())) {
            errors.push("Coupon already used by you");
        }

        
        if (coupon.usedBy.length >= coupon.maxUsage) {
            errors.push("Coupon usage limit reached");
        }

        if (cartTotal < coupon.minimumPrice) {
            errors.push(`Minimum order amount of ₹${coupon.minimumPrice} required`);
        }

        if (errors.length > 0) {
            return res.status(400).json({ status: false, message: errors.join(', ') });
        }

        // ✅ Calculate discount
        let discount = 0;
        if (coupon.offerPrice) {
            discount = Math.min(coupon.offerPrice, cartTotal);
        } else if (coupon.offerPercentage) {
            discount = Math.min(
                cartTotal * (coupon.offerPercentage / 100),
                coupon.maxDiscount || Infinity
            );
        }

        // ✅ Store coupon in session
        req.session.appliedCoupon = {
            code: coupon.name,
            discount: discount,
            couponId: coupon._id
        };

        return res.status(200).json({
            status: true,
            discount: discount,
            message: "Coupon applied successfully",
            remainingUsages: coupon.maxUsage - coupon.usedBy.length
        });

    } catch (error) {
        console.error('Coupon apply error:', error);
        return res.status(500).json({
            status: false,
            message: "Internal server error"
        });
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
