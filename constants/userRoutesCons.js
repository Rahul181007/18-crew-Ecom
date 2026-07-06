const USER_ROUTES = {
  // Authentication
  REGISTER: "/register",
  VERIFY_OTP: "/verify-otp",
  RESEND_OTP: "/resend-otp",
  SIGNIN: "/signin",
  LOGOUT: "/logout",

  // Google Auth
  GOOGLE_AUTH: "/auth/google",
  GOOGLE_CALLBACK: "/auth/google/callback",

  // Referral
  REFERRAL: "/referral",
  REFERRAL_SUBMIT: "/referral/submit",
  REFERRAL_SKIP: "/referral/skip",

  // Home
  HOME: "/",
  SHOP: "/shop",
  ABOUT: "/about",
  CONTACT: "/contact",

  // Search & Filter
  FILTER: "/filter",
  FILTER_PRICE: "/filterPrice",
  SEARCH: "/search",
  SEARCH_SUGGESTIONS: "/search/suggestions",

  // User Profile
  USER_PROFILE: "/userProfile",
  UPDATE_PROFILE: "/update-profile",
  DELETE_ACCOUNT: "/delete-account",

  // Password
  FORGOT_PASSWORD: "/forgot-password",
  FORGOT_EMAIL: "/forgotEmailValid",
  VERIFY_FORGOT_OTP: "/verifyPassForgot-otp",
  RESET_PASSWORD: "/reset-password",
  RESEND_FORGOT_OTP: "/resend-forgot-otp",

  // Email
  CHANGE_EMAIL: "/change-email",
  VERIFY_CHANGE_EMAIL: "/verifyChangeEmail-otp",
  RESET_EMAIL: "/reset-email",
  UPDATE_EMAIL: "/update-email",
  VERIFY_CHANGE_EMAIL_OTP: "/verifyChangeEmail-otp",
  // Change Password
  CHANGE_PASSWORD: "/change-password",

  // Address
  ADD_ADDRESS: "/addAddress",
  EDIT_ADDRESS: "/editAddress",
  DELETE_ADDRESS: "/deleteAddress/:addressId/:index",

  // Product
  PRODUCT_DETAILS: "/productDetails",

  // Cart
  CART: "/getCartPage",
  ADD_TO_CART: "/addToCart",
  CHANGE_QUANTITY: "/changeQuantity",
  DELETE_CART_ITEM: "/deleteItem/:cartItemId",

  // Wishlist
  WISHLIST: "/wishList",
  ADD_TO_WISHLIST: "/addToWishlist",
  REMOVE_WISHLIST: "/deleteitemwish",

  // Checkout
  CHECKOUT: "/checkout",
  RETRY_CHECKOUT: "/retry-checkout",
  CHECK_STOCK: "/checkStock",
  CHECK_STOCK_BEFORE: "/checkStockBeforeCheckout",
  DELETE_CHECKOUT_ITEM: "/deleteItem",
  PLACE_ORDER: "/orderPlaced",
  VERIFY_PAYMENT: "/verify-payment",
  SUCCESS_PAGE: "/successPage",
  FAILED_PAGE: "/failedPage",

  // Orders
  ORDER_DETAILS: "/orders/:orderId",
  CANCEL_ORDER: "/orders/cancel/:orderId",
  CANCEL_ORDER_ITEM: "/orders/cancel-item/:orderId/:itemId",
  RETURN_ORDER: "/orders/return/:orderId",
  DOWNLOAD_INVOICE: "/orders/invoice/:orderId",

  // Coupons
  APPLY_COUPON: "/applyCoupon",
  REMOVE_COUPON: "/removeCoupon",

  // Static Pages
  FAQ: "/faq",
  RETURNS: "/returns",
  SHIPPING: "/shipping",
  PRIVACY: "/privacy",

  // Misc
  CHECK_USER_BLOCK: "/check-user-block",
  PAGE_NOT_FOUND: "/pageNotFound",
  SEND_MESSAGE: "/sendMessage",
  COPY_REFERRAL_CODE: "/copy-referral-code",
};

module.exports = USER_ROUTES;