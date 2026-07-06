const express = require("express");
const body_parser = require("body-parser");
const multer = require("multer");
const user_route = express();
user_route.set("view engine", "ejs");
user_route.set("views", "./views/users");
user_route.use(body_parser.json());
user_route.use(body_parser.urlencoded({ extended: true }));
const userContoller = require("../controllers/user/userController");
const path = require("path");
const passport = require("passport");
const profileController = require("../controllers/user/profileControllers");
const { userAuth, adminAuth } = require("../middlewares/auth");
const productController = require("../controllers/user/productController");
const cartController = require("../controllers/user/cartController");
const wishListController = require("../controllers/user/wishListController");
const checkoutController = require("../controllers/user/checkoutController")
const couponController = require("../controllers/user/couponController")
const User = require("../models/userSchema");
const ROUTES=require("../constants/userRoutesCons");

// ..storage area for image
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../public/userimage"))
  },
  filename: function (req, file, cb) {
    const name = Date.now() + "-" + file.originalname;
    cb(null, name)
  }
})
const upload = multer({ storage: storage });





async function generateRefferalcode() {
  return 'REF' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

// signup management
user_route.get(ROUTES.REGISTER, userContoller.loadRegister);
user_route.post(ROUTES.REGISTER, userContoller.insertUser);
user_route.post(ROUTES.VERIFY_OTP, userContoller.verifyOtp)
user_route.post(ROUTES.RESEND_OTP, userContoller.resendOTP)
user_route.get(ROUTES.GOOGLE_AUTH, (req, res, next) => {

  if (req.query.ref) {
    req.session.referralCode = req.query.ref;
  }
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

user_route.get(
  ROUTES.GOOGLE_CALLBACK,
  passport.authenticate("google", { failureRedirect: "/register" }),
  async (req, res) => {
    try {

      req.session.user = req.user._id;

      if (!req.user.redeemed) {
        return res.redirect("/referral");
      }
  
      const redirectUrl = req.session.returnTo || "/";
      delete req.session.returnTo;

      res.redirect(redirectUrl);
    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect("/register");
    }
  }
);






user_route.get(ROUTES.REFERRAL, userContoller.referralPage);
user_route.post(ROUTES.REFERRAL_SUBMIT, userAuth, userContoller.postReferral)
user_route.get(ROUTES.REFERRAL_SKIP, userAuth, userContoller.skipReferral)
// sign in Management
user_route.get(ROUTES.SIGNIN, userContoller.loadLogin)
user_route.post(ROUTES.SIGNIN, userContoller.login)

//homepage  and shopping page
user_route.get(ROUTES.HOME, userContoller.loadhomepage);
user_route.get(ROUTES.LOGOUT, userAuth, userContoller.logout);
user_route.get(ROUTES.CHECK_USER_BLOCK, userContoller.checkUserBlock)
user_route.get(ROUTES.SHOP, userContoller.loadShoppingPage);
user_route.get(ROUTES.FILTER, userContoller.filterProduct)
user_route.get(ROUTES.FILTER_PRICE, userContoller.filterPrice);
user_route.post(ROUTES.SEARCH, userContoller.searchProduct);
user_route.get(ROUTES.SEARCH, userContoller.searchProduct);
user_route.get(ROUTES.SEARCH_SUGGESTIONS, userContoller.getSearchSuggestions);
user_route.get(ROUTES.ABOUT, userContoller.loadAboutPage);
user_route.get(ROUTES.CONTACT, userContoller.loadContactpage);
user_route.post(ROUTES.SEND_MESSAGE, userAuth, userContoller.recieveMessage);
// profileMangement
user_route.get(ROUTES.FORGOT_PASSWORD, profileController.getForgotPassPage)
user_route.post(ROUTES.FORGOT_EMAIL, profileController.forgotEmailValid);
user_route.post(ROUTES.VERIFY_FORGOT_OTP, profileController.verifyForgotPassOtp);
user_route.get(ROUTES.RESET_PASSWORD, profileController.getresetPassword);
user_route.post(ROUTES.RESEND_FORGOT_OTP, profileController.resendOTP);
user_route.post(ROUTES.RESET_PASSWORD, profileController.postResetPassword);
user_route.get(ROUTES.USER_PROFILE, userAuth, profileController.userProfile);
user_route.get(ROUTES.COPY_REFERRAL_CODE, userAuth, profileController.copyReferralCode);
user_route.get(ROUTES.CHANGE_EMAIL, userAuth, profileController.changeEmail);
user_route.post(ROUTES.CHANGE_EMAIL, userAuth, profileController.changeEmailValid)
user_route.post(ROUTES.VERIFY_CHANGE_EMAIL_OTP, userAuth, profileController.verifyChangeEmailOtp);
user_route.get(ROUTES.RESET_EMAIL, userAuth, profileController.getResetEmailPage);
user_route.post(ROUTES.UPDATE_EMAIL, userAuth, profileController.updateEmail);
user_route.get(ROUTES.CHANGE_PASSWORD, userAuth, profileController.changePassword);
user_route.post(ROUTES.CHANGE_PASSWORD, userAuth, profileController.changePassValid);
user_route.post(ROUTES.UPDATE_PROFILE, userAuth, upload.single("image"), profileController.updateProfile);
user_route.post(ROUTES.DELETE_ACCOUNT, userAuth, profileController.deleteAccn);
// address management
user_route.get(ROUTES.ADD_ADDRESS, userAuth, profileController.addAddress);
user_route.post(ROUTES.ADD_ADDRESS, userAuth, profileController.postAddAddress);
user_route.get(ROUTES.EDIT_ADDRESS, userAuth, profileController.editAddress);
user_route.post(ROUTES.EDIT_ADDRESS, userAuth, profileController.postEditAddress)
user_route.get(ROUTES.DELETE_ADDRESS, userAuth, profileController.deleteAddress)


// product details
user_route.get(ROUTES.PRODUCT_DETAILS, productController.productDetails);
// cart
user_route.get(ROUTES.CART, userAuth, cartController.getCartPage);
user_route.post(ROUTES.ADD_TO_CART, userAuth, cartController.addToCart);
user_route.post(ROUTES.CHANGE_QUANTITY, userAuth, cartController.changeQuantity);
user_route.delete(ROUTES.DELETE_CART_ITEM, userAuth, cartController.deleteProduct);
// wishlist management
user_route.get(ROUTES.WISHLIST, userAuth, wishListController.loadWishlist);
user_route.post(ROUTES.ADD_TO_WISHLIST, userAuth, wishListController.addToWishlist)
user_route.post(ROUTES.REMOVE_WISHLIST, userAuth, wishListController.removeFromWishlist)
// checkout management
user_route.get(ROUTES.CHECKOUT, userAuth, checkoutController.loadCheckout);
user_route.post(ROUTES.RETRY_CHECKOUT, userAuth, checkoutController.retryCheckout)
user_route.get(ROUTES.CHECK_STOCK_BEFORE, userAuth, checkoutController.checkStockBeforeCheckout);
user_route.post(ROUTES.DELETE_CHECKOUT_ITEM, userAuth, checkoutController.deleteProduct);
user_route.post(ROUTES.PLACE_ORDER, userAuth, checkoutController.placeOrder);
user_route.get(ROUTES.CHECK_STOCK, userAuth, checkoutController.checkStock)
user_route.get(ROUTES.SUCCESS_PAGE, userAuth, checkoutController.successPage);
user_route.get(ROUTES.ORDER_DETAILS, userAuth, checkoutController.orderDetails);
user_route.post(ROUTES.CANCEL_ORDER, userAuth, checkoutController.cancelOrder);
user_route.post(ROUTES.CANCEL_ORDER_ITEM, userAuth, checkoutController.cancelOrderItem);

user_route.post(ROUTES.RETURN_ORDER, userAuth, checkoutController.returnOrder);
user_route.post(ROUTES.VERIFY_PAYMENT, userAuth, checkoutController.verifyPayment)
user_route.get(ROUTES.FAILED_PAGE, userAuth, checkoutController.failedPage);
user_route.get(ROUTES.DOWNLOAD_INVOICE, userAuth, checkoutController.downloadInvoice)
// coupon management 

user_route.post(ROUTES.APPLY_COUPON, userAuth, couponController.applyCoupon)
user_route.post(ROUTES.REMOVE_COUPON, userAuth, couponController.removeCoupon);


// Faq
user_route.get(ROUTES.FAQ, userContoller.loadFaqpage);
user_route.get(ROUTES.RETURNS, userContoller.loadReturnPage);
user_route.get(ROUTES.SHIPPING, userContoller.loadShippingPage)
user_route.get(ROUTES.PRIVACY, userContoller.loadPrivacyPage)

// .........pagenot found.........
user_route.get(ROUTES.PAGE_NOT_FOUND, userContoller.pageNotFound);


module.exports = user_route;