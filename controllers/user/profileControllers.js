const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const Address = require("../../models/addressSchema");
const { name } = require("ejs");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const WalletTransaction = require("../../models/walletSchema");
const WishList = require("../../models/wishlistSchema");

// GENERATE OTP
function generateOtp() {
  const digits = "1234567890";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

// send verification Email
const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Your Otp for password reset",
      text: `Your OTP is ${otp}`,
      html: `<b><h4>Your OTP :${otp}</h4><br></b>`,
    };

    const info = transporter.sendMail(mailOptions);
    console.log("email sent", (await info).response);
    return true;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
};

// password Hashing
const securePassword = async (password) => {
  const passwordHash = await bcrypt.hash(password, 10);
  return passwordHash;
};

// forgot password
const getForgotPassPage = async (req, res) => {
  try {
    res.render("forgot-password", { title: "forgot-password" });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const forgotEmailValid = async (req, res, next) => {
  try {
    const { email } = req.body;

    const finduser = await User.findOne({ email: email });
    if (finduser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      console.log(emailSent);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;
        res.render("forgotPass-otp", { title: "forgotPass-otp" });
        
      } else {
        return res
          .status(500)
          .json({
            status: false,
            message: "Failed to send OTP. Please try again later",
          });
      }
    } else {
      return res.render("forgot-password", {
        message: "User with this mail id does not exist",
        title: "forgot-password",
      });
    }
  } catch (error) {
    next(error);
  }
};

const verifyForgotPassOtp = async (req, res, next) => {
  try {
    const otp = req.body.otp;
    
    if (otp === req.session.userOtp) {
      res.json({ status: true });
    } else {
      return res
        .status(400)
        .json({ status: false, message: "OTP not matching" });
    }
  } catch (error) {
    next(error);
  }
};

const getresetPassword = async (req, res, next) => {
  try {
    res.render("reset-password", { title: "reset-password" });
  } catch (error) {
    next(error);
  }
};

const resendOTP = async (req, res, next) => {
  try {
    const otp = generateOtp();
    req.session.userOtp = otp;
    const email = req.session.email;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("resend otp", otp);
      return res
        .status(200)
        .json({ status: true, message: "OTP resent successfully." });
    } else {
      return res
        .status(500)
        .json({
          status: false,
          message: "Failed to resend OTP. Please try again later.",
        });
    }
  } catch (error) {
    next(error);
  }
};

const postResetPassword = async (req, res, next) => {
  try {
    const { newPass1, newPass2 } = req.body;
    const email = req.session.email;
    if (newPass1 === newPass2) {
      const hashPassword = await securePassword(newPass1);
      await User.updateOne(
        { email: email },
        { $set: { password: hashPassword } }
      );
      res.redirect("/signin");
    } else {
      res.render("reset-password", {
        message: "Password donot match",
        title: "reset-password",
      });
    }
  } catch (error) {
    next(error);
  }
};
// profile

const userProfile = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      const error = new Error("Unauthorized access — please login.");
      error.statusCode = 401;
      return next(error);
    }
    const userData = await User.findById(userId);
    const addressData = await Address.findOne({ userId: userId });
    const orderData = await Order.find({ userId: userId }).sort({
      createdOn: -1,
    });
    const cart = await Cart.findOne({ userId: userId });
    const walletTransactions = await WalletTransaction.find({ userId });
    console.log("1", walletTransactions);
    let cartCount = 0;
    const wishlist = await WishList.findOne({ userId: userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    cartCount = cart && cart.items ? cart.items.length : 0;

    // Derive referrals for EJS compatibility
    const referrals = await User.find({ redeemed: true })
      .select("name createdOn")
      .lean()
      .then((users) =>
        users.map((ref) => ({
          name: ref.name,
          date: ref.createdOn,
          status: "completed", // Assuming successful signup means completed
        }))
      );
    console.log(referrals);

    // No coupons generated, so return empty referralCoupons
    const referralCoupons = [];

    res.render("profile", {
      user: {
        ...userData._doc,
        referralCode: userData.referralCode, // Map referalCode to referralCode for EJS
        referrals, // Derived referrals
        referralCoupons, // Empty coupons
      },
      userAddress: addressData || { address: [] },
      order: orderData,
      cartCount,
      wishlistCount,
      page: "profile",
      walletTransactions,
      title: "Profile",
    });
  } catch (error) {
    next(error);
  }
};

// change - email

const changeEmail = async (req, res, next) => {
  try {
    res.render("change-email", { title: "change-email" });
  } catch (error) {
    next(error);
  }
};
const changeEmailValid = async (req, res, next) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email: email });
    if (!findUser) {
      res.render("change-email", {
        message: "user with this email not found",
        title: "change-email",
      });
    } else {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;
        req.session.userData = req.body;
        res.render("change-email-otp", { title: "change-email-otp" });
      } else {
        return res
          .status(500)
          .json({
            status: false,
            message: "Failed to send OTP. Please try again later",
          });
      }
    }
  } catch (error) {
    next(error);
  }
};

const verifyChangeEmailOtp = async (req, res, next) => {
  try {
    const otpInput = req.body.otp;
    const sessionOtp = req.session.userOtp;
    

    if (!sessionOtp) {
      return res
        .status(400)
        .json({
          status: false,
          message: "No OTP found in session. Please request a new OTP.",
        });
    }

    if (otpInput === sessionOtp) {
      return res.status(200).json({ status: true });
    } else {
      return res
        .status(400)
        .json({ status: false, message: "OTP does not match." });
    }
  } catch (error) {
    next(error);
  }
};

const getResetEmailPage = async (req, res, next) => {
  try {
    res.render("new-email", {
      userData: req.session.userData,
      title: "new-email",
    });
  } catch (error) {
    next(error);
  }
};
// update email
const updateEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    const userId = req.session.user;
    const alreadyExist = await User.findOne({ email: email });
    if (alreadyExist) {
      res.render("new-email", {
        message: "user already exist",
        title: "new-email",
      });
    } else {
      await User.findByIdAndUpdate({ _id: userId }, { email: email });
      res.redirect("/userProfile");
    }
  } catch (error) {
    next(error);
  }
};

// change-password
const changePassword = async (req, res, next) => {
  try {
    res.render("change-password", { title: "change-password" });
  } catch (error) {
    next(error);
  }
};

const changePassValid = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user;

    // Validate all fields are present
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Find user and verify current password
    const findUser = await User.findById(userId);
    if (!findUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, findUser.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Hash and update the new password
    const hashPassword = await securePassword(newPassword);
    await User.updateOne({ _id: userId }, { $set: { password: hashPassword } });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Password change error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during password change",
    });
  }
};

//  update profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, mobile } = req.body;
    console.log(req.file);
    const id = req.session.user;
    const image = req.file ? req.file.filename : null;

    const findUser = await User.findOne({ _id: id });
    if (findUser) {
      const updateData = {
        name: name,
        mobile: mobile,
      };

      if (image) {
        updateData.image = image;
      }

      await User.findByIdAndUpdate(id, { $set: updateData });
      res.redirect("/userProfile");
    } else {
      res.redirect("/pageNotFound");
    }
  } catch (error) {
    next(error);
  }
};

// address Mangement

const addAddress = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId });
    let cartCount = 0;
    cartCount = cart && cart.items ? cart.items.length : 0;
      const wishlist = await WishList.findOne({ userId: userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    if (!userId) {
      return res.redirect("/signin"); //
    }

    const userData = await User.findById(userId);
    if (!userData) {
      return res.redirect("/pageNotFound");
    }

    res.render("add-address", {
      user: userData,
      cartCount,
      wishlistCount,
      title: "Address-add",
    });
  } catch (error) {
    next(error);
  }
};

const postAddAddress = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/signin");
    }

    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      return res.redirect("/pageNotFound");
    }

    const {
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      mobile,
      altMobile,
    } = req.body;

    // Validate required fields
    if (!addressType || !name || !city || !state || !pincode || !mobile) {
      return res.status(400).render("add-address", {
        user: userData,
        cartCount: userData?.cart?.length ?? 0,
        wishlistCount: userData?.wishlist?.length ?? 0,
        error: "Please fill in all required fields.",
        title: "Address-add",
      });
    }

    let userAddress = await Address.findOne({ userId: userData._id });

    if (!userAddress) {
      userAddress = new Address({
        userId: userData._id,
        address: [
          {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            mobile,
            altMobile,
          },
        ],
      });
    } else {
      userAddress.address.push({
        addressType,
        name,
        city,
        landMark,
        state,
        pincode,
        mobile,
        altMobile,
      });
    }

    await userAddress.save();
    res.redirect("/userProfile");
  } catch (error) {
    next(error);
  }
};

const editAddress = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/signin");
    }
    const cart = await Cart.findOne({ userId });
    let cartCount = 0;
    cartCount = cart && cart.items ? cart.items.length : 0;
      const wishlist = await WishList.findOne({ userId: userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    const userData = await User.findById(userId);
    if (!userData) {
      return res.redirect("/pageNotFound");
    }

    const { id: addressId, index } = req.query;
    if (!addressId || index === undefined) {
      return res.redirect("/pageNotFound");
    }

    const currAddress = await Address.findOne({ _id: addressId, userId });
    if (!currAddress) {
      return res.redirect("/pageNotFound");
    }

    const addressIndex = parseInt(index);
    if (isNaN(addressIndex) || !currAddress.address[addressIndex]) {
      return res.redirect("/pageNotFound");
    }

    const addressData = currAddress.address[addressIndex];

    // Determine the source from the referer header
    const referer = req.headers.referer || "";
    const source = referer.includes("/checkout") ? "checkout" : "userProfile";

    res.render("edit-address", {
      address: addressData,
      addressId,
      addressIndex,
      user: userData,
      cartCount,
      wishlistCount,
      source,
      title: "Address-edit",
    });
  } catch (error) {
    next(error);
  }
};

const postEditAddress = async (req, res, next) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/signin");
    }

    const {
      addressId,
      addressIndex,
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      mobile,
      altMobile,
      source,
    } = req.body;

    if (!addressId || addressIndex === undefined) {
      return res.redirect("/pageNotFound");
    }

    // Validate required fields
    if (!addressType || !name || !city || !state || !pincode || !mobile) {
      const userData = await User.findById(userId);
      if (!userData) {
        return res.redirect("/pageNotFound");
      }
      return res.status(400).render("edit-address", {
        address: {
          addressType,
          name,
          city,
          landMark,
          state,
          pincode,
          mobile,
          altMobile,
        },
        addressId,
        addressIndex,
        user: userData,
        cartCount: userData?.cart?.length ?? 0,
        wishlistCount: userData?.wishlist?.length ?? 0,
        source, // Pass source back to the form in case of validation error
        error: "Please fill in all required fields.",
        title: "Address-edit",
      });
    }

    const findAddress = await Address.findOne({ _id: addressId, userId });
    if (!findAddress) {
      return res.redirect("/pageNotFound");
    }

    const index = parseInt(addressIndex);
    if (isNaN(index) || !findAddress.address[index]) {
      return res.redirect("/pageNotFound");
    }

    // Update the specific address in the array
    findAddress.address[index] = {
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      mobile,
      altMobile,
    };

    // Save the updated address
    await findAddress.save();

    // Redirect based on source
    if (source === "checkout") {
      return res.redirect("/checkout");
    } else {
      return res.redirect("/userProfile");
    }
  } catch (error) {
    next(error);
  }
};

const mongoose = require("mongoose");

const deleteAddress = async (req, res, next) => {
  try {
    const { addressId, index } = req.params;
    console.log(req.params);
    console.log("Address ID:", addressId);

    const objectId = new mongoose.Types.ObjectId(addressId);

    // Check if address exists
    const findAddress = await Address.findOne({ "address._id": objectId });
    if (!findAddress) {
      return res.status(404).send("Address not found");
    }

    // Perform delete
    await Address.updateOne(
      { "address._id": objectId },
      { $pull: { address: { _id: objectId } } }
    );

    res.redirect("/userProfile");
  } catch (error) {
    next(error);
  }
};

const deleteAccn = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.session.user);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (user.googleId) {
      await User.deleteOne({ _id: user._id });
      await Address.deleteMany({ userId: user._id });
      await Order.deleteMany({ userId: user._id });
      req.session.destroy(); // Destroy the session
      return res.status(200).json({ success: true });
    }

    // Verify password for non-Google users
    if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "Password is required." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password." });
    }

    // Delete user data
    await User.deleteOne({ _id: user._id });
    await Address.deleteMany({ userId: user._id }); // Delete associated addresses
    await Order.deleteMany({ userId: user._id }); // Delete associated orders, if applicable

    // Destroy the session to log out the user
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res
          .status(500)
          .json({ success: false, message: "Failed to log out." });
      }
      return res.status(200).json({ success: true });
    });
  } catch (error) {
    next(error);
  }
};

const copyReferralCode = async (req, res, next) => {
  try {
    console.log("Fetching referral code");
    console.log(req.session.user);
    const user = await User.findById(req.session.user);
    console.log("User:", user);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!user.referralCode) {
      return res
        .status(400)
        .json({ success: false, message: "No referral code found" });
    }
    res.json({ success: true, referralCode: user.referralCode });
  } catch (error) {
    console.error("Error in copyReferralCode:", error);
    next(error);
  }
};

module.exports = {
  getForgotPassPage,
  forgotEmailValid,
  verifyForgotPassOtp,
  getresetPassword,
  resendOTP,
  postResetPassword,
  userProfile,
  changeEmail,
  changePassword,
  changeEmailValid,
  verifyChangeEmailOtp,
  getResetEmailPage,
  updateEmail,
  changePassValid,
  updateProfile,
  addAddress,
  postAddAddress,
  editAddress,
  postEditAddress,
  deleteAddress,
  deleteAccn,
  copyReferralCode,
};
