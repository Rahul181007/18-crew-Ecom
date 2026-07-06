const ADMIN_ROUTES = {
  // Auth
  LOGIN: "/login",
  LOGOUT: "/logout",
  PAGE_ERROR: "/pageError",

  // Dashboard
  DASHBOARD: "/dashboard",
  SALES_REPORT: "/dashboard/reports",
  SALES_REPORT_DATA: "/dashboard/reports/data",
  SALES_REPORT_DOWNLOAD: "/dashboard/reports/download",
  BEST_PRODUCTS: "/dashboard/reports/best-products",
  BEST_CATEGORIES: "/dashboard/reports/best-categories",
  BEST_BRANDS: "/dashboard/reports/best-brands",

  // Users
  USERS: "/users",
  BLOCK_CUSTOMER: "/blockCustomer",
  UNBLOCK_CUSTOMER: "/unblockCustomer",

  // Categories
  CATEGORY: "/category",
  ADD_CATEGORY: "/addcategory",
  ADD_CATEGORY_OFFER: "/addCategoryOffer",
  REMOVE_CATEGORY_OFFER: "/removeCategoryOffer",
  LIST_CATEGORY: "/listCategory",
  UNLIST_CATEGORY: "/unlistCategory",
  EDIT_CATEGORY: "/editCategory",

  // Brands
  BRANDS: "/brands",
  ADD_BRAND: "/addBrands",
  BLOCK_BRAND: "/blockBrand",
  UNBLOCK_BRAND: "/unblockBrand",
  DELETE_BRAND: "/deleteBrand",

  // Products
  ADD_PRODUCT: "/addProducts",
  PRODUCTS: "/products",
  ADD_PRODUCT_OFFER: "/addProductOffer",
  REMOVE_PRODUCT_OFFER: "/removeProductOffer",
  BLOCK_PRODUCT: "/blockProduct",
  UNBLOCK_PRODUCT: "/unblockProduct",
  EDIT_PRODUCT: "/editProduct",
  UPDATE_PRODUCT_IMAGE: "/updateProductImage",

  // Orders
  ORDERS: "/orderList",
  ORDER_DETAILS: "/orders/:orderId",
  UPDATE_ORDER_STATUS: "/orders/update-status/:orderId",
  APPROVE_RETURN: "/orders/approve-return/:orderId",
  REJECT_RETURN: "/orders/reject-return/:orderId",

  // Coupons
  COUPONS: "/coupons",
  COUPONS_LIST: "/coupons/list",
  COUPON_BY_NAME: "/coupons/:name",
  COUPON_USERS: "/coupon/users/:name",

  // Banners
  BANNERS: "/banners",
  ADD_BANNER_PAGE: "/banners/add",
  DELETE_BANNER: "/banners/delete/:id",
};



module.exports = ADMIN_ROUTES;