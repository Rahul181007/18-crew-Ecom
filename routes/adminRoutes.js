const express = require('express');
const admin_route = express();
const adminController = require("../controllers/admin/adminController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const nocache = require("nocache");
const multer = require("multer");
const storage = require("../helpers/multer");
const upload = multer({ storage: storage })
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productContoller");
const orderController = require("../controllers/admin/orderController");
const couponController = require("../controllers/admin/couponController");
const reportController = require("../controllers/admin/reportController");
const bannerControlleer = require("../controllers/admin/bannerController");
const ROUTES=require("../constants/adminRoutesCons");

const path = require("path");

const storage1 = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads/banner"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const bannerUpload = multer({ storage: storage1 });


admin_route.set("view engine", "ejs");
admin_route.set("views", "./views/admin");
admin_route.use(nocache());
// login management
admin_route.get(ROUTES.LOGIN, adminController.loadLogin);
admin_route.post(ROUTES.LOGIN, adminController.login);
// page error
admin_route.get(ROUTES.PAGE_ERROR, adminController.pageError)
// dashboarmanagement
admin_route.get(ROUTES.DASHBOARD, adminAuth, adminController.loadDashboard);
admin_route.get(ROUTES.SALES_REPORT, adminAuth, reportController.salesReportPage);
admin_route.post(ROUTES.SALES_REPORT_DATA, adminAuth, reportController.getSalesData);
admin_route.get(ROUTES.SALES_REPORT_DOWNLOAD, adminAuth, reportController.downloadReport);
admin_route.get(ROUTES.BEST_PRODUCTS, adminAuth, reportController.getBestSellingProducts);
admin_route.get(ROUTES.BEST_CATEGORIES, adminAuth, reportController.getBestSellingCategories);
admin_route.get(ROUTES.BEST_BRANDS, adminAuth, reportController.getBestSellingBrands);

admin_route.get(ROUTES.LOGOUT, adminController.logout)
// customer management
admin_route.get(ROUTES.USERS, adminAuth, customerController.customerInfo);
admin_route.get(ROUTES.BLOCK_CUSTOMER, adminAuth, customerController.customerBlocked);
admin_route.get(ROUTES.UNBLOCK_CUSTOMER, adminAuth, customerController.customerunBlocked);
// category management
admin_route.get(ROUTES.CATEGORY, adminAuth, categoryController.categoryInfo);
admin_route.post(ROUTES.ADD_CATEGORY, adminAuth, upload.single('image'), categoryController.addCategory);
admin_route.post(ROUTES.ADD_CATEGORY_OFFER, adminAuth, categoryController.addCategoryOffer);
admin_route.post(ROUTES.REMOVE_CATEGORY_OFFER, adminAuth, categoryController.removeCategoryOffer);
admin_route.get(ROUTES.LIST_CATEGORY, adminAuth, categoryController.getListCategory);
admin_route.get(ROUTES.UNLIST_CATEGORY, adminAuth, categoryController.getunListCategory);
admin_route.get(ROUTES.EDIT_CATEGORY, adminAuth, categoryController.geteditCategory);
admin_route.post(ROUTES.EDIT_CATEGORY + "/:id", adminAuth, categoryController.editCategory);
// brand management
admin_route.get(ROUTES.BRANDS, adminAuth, brandController.getBrandPage);
admin_route.post(ROUTES.ADD_BRAND, adminAuth, upload.single("image"), brandController.addBrand)
admin_route.get(ROUTES.BLOCK_BRAND, adminAuth, brandController.blockBrand);
admin_route.get(ROUTES.UNBLOCK_BRAND, adminAuth, brandController.unblockBrand);
admin_route.get(ROUTES.DELETE_BRAND, adminAuth, brandController.deleteBrand);
// product management
admin_route.get(ROUTES.ADD_PRODUCT, adminAuth, productController.getProductAddPage)
admin_route.post(ROUTES.ADD_PRODUCT, adminAuth, upload.array("images", 4), productController.addProducts);
admin_route.get(ROUTES.PRODUCTS, adminAuth, productController.getAllProduct);
admin_route.post(ROUTES.ADD_PRODUCT_OFFER, adminAuth, productController.addProductOffer);
admin_route.post(ROUTES.REMOVE_PRODUCT_OFFER, adminAuth, productController.removeProductOffer);
admin_route.get(ROUTES.BLOCK_PRODUCT, adminAuth, productController.blockProduct);
admin_route.get(ROUTES.UNBLOCK_PRODUCT, adminAuth, productController.unblockProduct);
admin_route.get(ROUTES.EDIT_PRODUCT, adminAuth, productController.geteditProduct);
admin_route.post(ROUTES.EDIT_PRODUCT + "/:id", adminAuth, upload.array("images", 4), productController.editProduct);
admin_route.post(ROUTES.UPDATE_PRODUCT_IMAGE, upload.single('image'), productController.updateProductImage);

// order management
admin_route.get(ROUTES.ORDERS, adminAuth, orderController.loadOrderList)
admin_route.post(ROUTES.UPDATE_ORDER_STATUS, adminAuth, orderController.updateOrderStatus);
admin_route.get(ROUTES.ORDER_DETAILS, adminAuth, orderController.loadOrderDetail);
admin_route.post(ROUTES.APPROVE_RETURN, adminAuth, orderController.approveReturn);
admin_route.post(ROUTES.REJECT_RETURN, adminAuth, orderController.rejectReturn);

// coupon management
admin_route.get(ROUTES.COUPONS, adminAuth, couponController.loadCouponPage);
admin_route.post(ROUTES.COUPONS, adminAuth, couponController.addCoupon);
admin_route.get(ROUTES.COUPONS_LIST, adminAuth, couponController.getCoupons);
admin_route.delete(ROUTES.COUPON_BY_NAME, adminAuth, couponController.deleteCoupon)
admin_route.put(ROUTES.COUPON_BY_NAME, adminAuth, couponController.updateCoupon);
admin_route.get(ROUTES.COUPON_USERS, adminAuth, couponController.getCouponsUsers);

// banner mangement
admin_route.get(ROUTES.BANNERS, adminAuth, bannerControlleer.getBanners);
admin_route.get(ROUTES.ADD_BANNER_PAGE, adminAuth, bannerControlleer.addBannerPage)
admin_route.post(ROUTES.ADD_BANNER_PAGE, adminAuth, bannerUpload.single("image"), adminAuth, bannerControlleer.addBanner);
admin_route.get(ROUTES.DELETE_BANNER , adminAuth, bannerControlleer.deleteBanner);
module.exports = admin_route;

