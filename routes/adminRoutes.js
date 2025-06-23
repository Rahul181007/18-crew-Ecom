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
admin_route.get("/login", adminController.loadLogin);
admin_route.post("/login", adminController.login);
// page error
admin_route.get("/pageError", adminController.pageError)
// dashboarmanagement
admin_route.get("/dashboard", adminAuth, adminController.loadDashboard);
admin_route.get('/dashboard/reports', adminAuth, reportController.salesReportPage);
admin_route.post('/dashboard/reports/data', adminAuth, reportController.getSalesData);
admin_route.get('/dashboard/reports/download', adminAuth, reportController.downloadReport);
admin_route.get('/dashboard/reports/best-products', adminAuth, reportController.getBestSellingProducts);
admin_route.get('/dashboard/reports/best-categories', adminAuth, reportController.getBestSellingCategories);
admin_route.get('/dashboard/reports/best-brands', adminAuth, reportController.getBestSellingBrands);

admin_route.get("/logout", adminController.logout)
// customer management
admin_route.get("/users", adminAuth, customerController.customerInfo);
admin_route.get("/blockCustomer", adminAuth, customerController.customerBlocked);
admin_route.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);
// category management
admin_route.get("/category", adminAuth, categoryController.categoryInfo);
admin_route.post("/addcategory", adminAuth, upload.single('image'), categoryController.addCategory);
admin_route.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer);
admin_route.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer);
admin_route.get("/listCategory", adminAuth, categoryController.getListCategory);
admin_route.get("/unlistCategory", adminAuth, categoryController.getunListCategory);
admin_route.get("/editCategory", adminAuth, categoryController.geteditCategory);
admin_route.post("/editCategory/:id", adminAuth, categoryController.editCategory);
// brand management
admin_route.get("/brands", adminAuth, brandController.getBrandPage);
admin_route.post("/addBrands", adminAuth, upload.single("image"), brandController.addBrand)
admin_route.get("/blockBrand", adminAuth, brandController.blockBrand);
admin_route.get("/unblockBrand", adminAuth, brandController.unblockBrand);
admin_route.get("/deleteBrand", adminAuth, brandController.deleteBrand);
// product management
admin_route.get("/addProducts", adminAuth, productController.getProductAddPage)
admin_route.post("/addProducts", adminAuth, upload.array("images", 4), productController.addProducts);
admin_route.get("/products", adminAuth, productController.getAllProduct);
admin_route.post("/addProductOffer", adminAuth, productController.addProductOffer);
admin_route.post("/removeProductOffer", adminAuth, productController.removeProductOffer);
admin_route.get("/blockProduct", adminAuth, productController.blockProduct);
admin_route.get("/unblockProduct", adminAuth, productController.unblockProduct);
admin_route.get("/editProduct", adminAuth, productController.geteditProduct);
admin_route.post("/editProduct/:id", adminAuth, upload.array("images", 4), productController.editProduct);
admin_route.post('/updateProductImage', upload.single('image'), productController.updateProductImage);

// order management
admin_route.get("/orderList", adminAuth, orderController.loadOrderList)
admin_route.post("/orders/update-status/:orderId", adminAuth, orderController.updateOrderStatus);
admin_route.get("/orders/:orderId", adminAuth, orderController.loadOrderDetail);
admin_route.post('/orders/approve-return/:orderId', adminAuth, orderController.approveReturn);
admin_route.post('/orders/reject-return/:orderId', adminAuth, orderController.rejectReturn);

// coupon management
admin_route.get("/coupons", adminAuth, couponController.loadCouponPage);
admin_route.post("/coupons", adminAuth, couponController.addCoupon);
admin_route.get('/coupons/list', adminAuth, couponController.getCoupons);
admin_route.delete('/coupons/:name', adminAuth, couponController.deleteCoupon)
admin_route.put('/coupons/:name', adminAuth, couponController.updateCoupon);
admin_route.get('/coupon/users/:name', adminAuth, couponController.getCouponsUsers);

// banner mangement
admin_route.get("/banners", adminAuth, bannerControlleer.getBanners);
admin_route.get("/banners/add", adminAuth, bannerControlleer.addBannerPage)
admin_route.post("/banners/add", adminAuth, bannerUpload.single("image"), adminAuth, bannerControlleer.addBanner);
admin_route.get("/banners/delete/:id", adminAuth, bannerControlleer.deleteBanner);

admin_route.get('*', (req, res) => {
  res.status(404).render("admin-error", {
    activePage: "admin-error",
  });
});
module.exports = admin_route;

