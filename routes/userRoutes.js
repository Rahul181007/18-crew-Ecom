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
user_route.get("/register", userContoller.loadRegister);
user_route.post("/register", userContoller.insertUser);
user_route.post("/verify-otp", userContoller.verifyOtp)
user_route.post("/resend-otp", userContoller.resendOTP)
user_route.get('/auth/google', (req, res, next) => {

  if (req.query.ref) {
    req.session.referralCode = req.query.ref;
  }
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

user_route.get(
  "/auth/google/callback",
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






user_route.get("/referral", userContoller.referralPage);
user_route.post("/referral/submit", userAuth, userContoller.postReferral)
user_route.get("/referral/skip", userAuth, userContoller.skipReferral)
// sign in Management
user_route.get("/signin", userContoller.loadLogin)
user_route.post("/signin", userContoller.login)

//homepage  and shopping page
user_route.get("/", userContoller.loadhomepage);
user_route.get("/logout", userAuth, userContoller.logout);
user_route.get("/check-user-block", userContoller.checkUserBlock)
user_route.get("/shop", userContoller.loadShoppingPage);
user_route.get("/filter", userContoller.filterProduct)
user_route.get("/filterPrice", userContoller.filterPrice);
user_route.post("/search", userContoller.searchProduct);
user_route.get("/search", userContoller.searchProduct);
user_route.get("/search/suggestions", userContoller.getSearchSuggestions);
user_route.get("/about", userContoller.loadAboutPage);
user_route.get("/contact", userContoller.loadContactpage);
user_route.post("/sendMessage", userAuth, userContoller.recieveMessage);
// profileMangement
user_route.get("/forgot-password", profileController.getForgotPassPage)
user_route.post("/forgotEmailValid", profileController.forgotEmailValid);
user_route.post("/verifyPassForgot-otp", profileController.verifyForgotPassOtp);
user_route.get("/reset-password", profileController.getresetPassword);
user_route.post("/resend-forgot-otp", profileController.resendOTP);
user_route.post("/reset-password", profileController.postResetPassword);
user_route.get("/userProfile", userAuth, profileController.userProfile);
user_route.get("/copy-referral-code", userAuth, profileController.copyReferralCode);
user_route.get("/change-email", userAuth, profileController.changeEmail);
user_route.post("/change-email", userAuth, profileController.changeEmailValid)
user_route.post("/verifyChangeEmail-otp", userAuth, profileController.verifyChangeEmailOtp);
user_route.get("/reset-email", userAuth, profileController.getResetEmailPage);
user_route.post("/update-email", userAuth, profileController.updateEmail);
user_route.get("/change-password", userAuth, profileController.changePassword);
user_route.post("/change-password", userAuth, profileController.changePassValid);
user_route.post("/update-profile", userAuth, upload.single("image"), profileController.updateProfile);
user_route.post("/delete-account", userAuth, profileController.deleteAccn);
// address management
user_route.get("/addAddress", userAuth, profileController.addAddress);
user_route.post("/addAddress", userAuth, profileController.postAddAddress);
user_route.get("/editAddress", userAuth, profileController.editAddress);
user_route.post("/editAddress", userAuth, profileController.postEditAddress)
user_route.get("/deleteAddress/:addressId/:index", userAuth, profileController.deleteAddress)


// product details
user_route.get("/productDetails", productController.productDetails);
// cart
user_route.get("/getCartPage", userAuth, cartController.getCartPage);
user_route.post("/addToCart", userAuth, cartController.addToCart);
user_route.post("/changeQuantity", userAuth, cartController.changeQuantity);
user_route.delete("/deleteItem/:cartItemId", userAuth, cartController.deleteProduct);
// wishlist management
user_route.get("/wishList", userAuth, wishListController.loadWishlist);
user_route.post("/addToWishlist", userAuth, wishListController.addToWishlist)
user_route.post("/deleteitemwish", userAuth, wishListController.removeFromWishlist)
// checkout management
user_route.get("/checkout", userAuth, checkoutController.loadCheckout);
user_route.post("/retry-checkout", userAuth, checkoutController.retryCheckout)
user_route.get("/checkStockBeforeCheckout", userAuth, checkoutController.checkStockBeforeCheckout);
user_route.post("/deleteItem", userAuth, checkoutController.deleteProduct);
user_route.post("/orderPlaced", userAuth, checkoutController.placeOrder);
user_route.get("/checkStock", userAuth, checkoutController.checkStock)
user_route.get("/successPage", userAuth, checkoutController.successPage);
user_route.get("/orders/:orderId", userAuth, checkoutController.orderDetails);
user_route.post("/orders/cancel/:orderId", userAuth, checkoutController.cancelOrder);
user_route.post('/orders/cancel-item/:orderId/:itemId', userAuth, checkoutController.cancelOrderItem);

user_route.post("/orders/return/:orderId", userAuth, checkoutController.returnOrder);
user_route.post('/verify-payment', userAuth, checkoutController.verifyPayment)
user_route.get("/failedPage", userAuth, checkoutController.failedPage);
user_route.get('/orders/invoice/:orderId', userAuth, checkoutController.downloadInvoice)
// coupon management 

user_route.post("/applyCoupon", userAuth, couponController.applyCoupon)
user_route.post("/removeCoupon", userAuth, couponController.removeCoupon);


// Faq
user_route.get("/faq", userContoller.loadFaqpage);
user_route.get("/returns", userContoller.loadReturnPage);
user_route.get("/shipping", userContoller.loadShippingPage)
user_route.get("/privacy", userContoller.loadPrivacyPage)

// .........pagenot found.........
user_route.get("/pageNotFound", userContoller.pageNotFound);


module.exports = user_route;