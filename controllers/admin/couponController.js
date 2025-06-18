const Coupon = require("../../models/couponSchema");
const { body, validationResult } = require("express-validator");

const loadCouponPage = async (req, res, next) => {
  try {
    res.render("coupon", {
      activePage: "coupon",
    });
  } catch (error) {
    
    next(error);
  }
};

const addCoupon = async (req, res) => {
  const couponValidationRules = [
    body("name")
      .notEmpty()
      .withMessage("Coupon code is required")
      .matches(/^[A-Z0-9]{4,10}$/)
      .withMessage(
        "Coupon code must be 4-10 uppercase alphanumeric characters"
      ),
    body("discountType")
      .notEmpty()
      .withMessage("Discount type is required")
      .isIn(["price", "percentage"])
      .withMessage('Discount type must be either "price" or "percentage"'),
    body("offerPrice")
      .if(body("discountType").equals("price"))
      .isFloat({ min: 0.01 })
      .withMessage(
        "Offer price must be at least 0.01 for fixed amount discounts"
      ),
    body("offerPercentage")
      .if(body("discountType").equals("percentage"))
      .isFloat({ min: 0.01, max: 100 })
      .withMessage("Offer percentage must be between 0.01 and 100"),
    body("minimumPrice")
      .isFloat({ min: 0 })
      .withMessage("Minimum purchase amount cannot be negative"),
    body("maxUsage")
      .isInt({ min: 1 })
      .withMessage("Usage limit must be at least 1"),
    body("expireOn")
      .notEmpty()
      .withMessage("Expiration date is required")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("Expiration date must be in YYYY-MM-DD format")
      .custom((value) => {
        const expirationDate = new Date(value);
        if (isNaN(expirationDate.getTime())) {
          throw new Error("Invalid expiration date");
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        if (expirationDate <= today) {
          throw new Error("Expiration date must be in the future");
        }
        return true;
      }),
    body("islist").isBoolean().withMessage("islist must be a boolean"),
  ];

  try {
    
    await Promise.all(
      couponValidationRules.map((validation) => validation.run(req))
    );
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      discountType,
      offerPrice,
      offerPercentage,
      minimumPrice,
      maxUsage,
      expireOn,
      islist,
    } = req.body;

    const coupon = new Coupon({
      name: name.toUpperCase(),
      discountType,
      offerPrice: discountType === "price" ? parseFloat(offerPrice) : null,
      offerPercentage:
        discountType === "percentage" ? parseFloat(offerPercentage) : null,
      minimumPrice: parseFloat(minimumPrice),
      maxUsage: parseInt(maxUsage),
      expireOn: new Date(expireOn),
      islist,
      usedBy: [],
    });

    await coupon.save();
    res
      .status(200)
      .json({ success: true, message: "Coupon created successfully" });
  } catch (error) {
    
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ errors: [{ msg: "Coupon code already exists" }] });
    }
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        msg: err.message,
      }));
      return res.status(400).json({ errors });
    }
    res
      .status(500)
      .json({ errors: [{ msg: "Server error. Please try again." }] });
  }
};

const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find()
      .select(
        "name discountType offerPrice offerPercentage minimumPrice maxUsage expireOn isActive usedBy"
      )
      .populate("usedBy.userId", "name email");
    res.status(200).json(coupons);
  } catch (error) {
    
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const { name } = req.params;
    const coupon = await Coupon.findOneAndDelete({ name: name.toUpperCase() });
    if (!coupon) {
      res.status(404).json({ error: [{ msg: "Coupon not Found" }] });
    }
    res.status(200).json({ message: "Coupon successfully deleted" });
  } catch (error) {
    
    next(error);
  }
};
const updateCoupon = async (req, res) => {
  const couponValidationRules = [
    body("discountType")
      .notEmpty()
      .withMessage("Discount type is required")
      .isIn(["price", "percentage"])
      .withMessage("Discount type must be either 'price' or 'percentage'"),
    body("offerPrice")
      .if(body("discountType").equals("price"))
      .isFloat({ min: 0.01 })
      .withMessage(
        "Offer price must be at least 0.01 for fixed amount discounts"
      ),
    body("offerPercentage")
      .if(body("discountType").equals("percentage"))
      .isFloat({ min: 0.01, max: 100 })
      .withMessage("Offer percentage must be between 0.01 and 100"),
    body("minimumPrice")
      .isFloat({ min: 0 })
      .withMessage("Minimum purchase amount cannot be negative"),
    body("maxUsage")
      .isInt({ min: 1 })
      .withMessage("Usage limit must be at least 1"),
    body("expireOn")
      .notEmpty()
      .withMessage("Expiration date is required")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("Expiration date must be in YYYY-MM-DD format")
      .custom((value) => {
        const expirationDate = new Date(value);
        if (isNaN(expirationDate.getTime())) {
          throw new Error("Invalid expiration date");
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expirationDate <= today) {
          throw new Error("Expiration date must be in the future");
        }
        return true;
      }),
  ];

  try {
    
    await Promise.all(
      couponValidationRules.map((validation) => validation.run(req))
    );
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.params;
    
    const {
      discountType,
      offerPrice,
      offerPercentage,
      minimumPrice,
      maxUsage,
      expireOn,
    } = req.body;

    const updateData = {
      discountType,
      offerPrice: discountType === "price" ? parseFloat(offerPrice) : null,
      offerPercentage:
        discountType === "percentage" ? parseFloat(offerPercentage) : null,
      minimumPrice: parseFloat(minimumPrice),
      maxUsage: parseInt(maxUsage),
      expireOn: new Date(expireOn),
    };

    

    const coupon = await Coupon.findOneAndUpdate(
      { name: name.toUpperCase() },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!coupon) {
      
      return res.status(404).json({ errors: [{ msg: "Coupon not found" }] });
    }

    
    res.status(200).json({ message: "Coupon updated successfully", coupon });
  } catch (error) {
    console.error("Error updating coupon:", error.stack);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        msg: err.message,
      }));
      return res.status(400).json({ errors });
    }
    res
      .status(500)
      .json({ errors: [{ msg: "Server error. Please try again." }] });
  }
};
const getCouponsUsers = async (req, res, next) => {
  try {
    const { name } = req.params;
    console.log(req.params);
    console.log("Fetching users for coupon:", name);
    const coupon = await Coupon.findOne({ name: name.toUpperCase() })
      .select("usedBy")
      .populate({
        path: "usedBy.userId",
        select: "name email",
        model: "User",
      })
      .exec();
    
    if (!coupon) {
      
      return res.status(404).json({ errors: [{ msg: "Coupon not found" }] });
    }

    const users = coupon.usedBy
      .filter((entry) => entry.userId)
      .map((entry) => ({
        _id: entry.userId._id,
        name: entry.userId.name || "Anonymous",
        email: entry.userId.email || "N/A",
        usageDate: entry.usageDate || null,
      }));
    

    res.status(200).json(users);
  } catch (error) {
    
    next(error);
  }
};

module.exports = {
  loadCouponPage,
  addCoupon,
  getCoupons,
  deleteCoupon,
  updateCoupon,
  getCouponsUsers,
};
