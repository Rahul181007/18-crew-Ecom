const express = require('express');
const admin_route = express(); 
const adminController = require("../controllers/admin/adminController");
const {userAuth,adminAuth}=require("../middlewares/auth");
const customerController=require("../controllers/admin/customerController");
const categoryController=require("../controllers/admin/categoryController");
const nocache=require("nocache");
const multer=require("multer");
const storage=require("../helpers/multer");
const upload=multer({storage:storage})
const brandController=require("../controllers/admin/brandController");
const productController=require("../controllers/admin/productContoller");



admin_route.set("view engine","ejs");
admin_route.set("views","./views/admin");
admin_route.use(nocache());
// login management
admin_route.get("/login", adminController.loadLogin);
admin_route.post("/login",adminController.login);
// page error
admin_route.get("/pageError",adminController.pageError)
// dashboarmanagement
admin_route.get("/",adminAuth,adminController.loadDashboard);
admin_route.get("/logout",adminController.logout)
// customer management
admin_route.get("/users",adminAuth,customerController.customerInfo);
admin_route.get("/blockCustomer",adminAuth,customerController.customerBlocked);
admin_route.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);
// category management
admin_route.get("/category",adminAuth,categoryController.categoryInfo);
admin_route.post("/addcategory",adminAuth,upload.single('image'),categoryController.addCategory);
admin_route.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer);
admin_route.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer);
admin_route.get("/listCategory",adminAuth,categoryController.getListCategory);
admin_route.get("/unlistCategory",adminAuth,categoryController.getunListCategory);
admin_route.get("/editCategory",adminAuth,categoryController.geteditCategory);
admin_route.post("/editCategory/:id",adminAuth,categoryController.editCategory);
// brand management
admin_route.get("/brands",adminAuth,brandController.getBrandPage);
admin_route.post("/addBrands",adminAuth,upload.single("image"),brandController.addBrand)
admin_route.get("/blockBrand",adminAuth,brandController.blockBrand);
admin_route.get("/unblockBrand",adminAuth,brandController.unblockBrand);
admin_route.get("/deleteBrand",adminAuth,brandController.deleteBrand);
// product management
admin_route.get("/addProducts",adminAuth,productController.getProductAddPage)
admin_route.post("/addProducts",adminAuth,upload.array("images",4),productController.addProducts);
admin_route.get("/products",adminAuth,productController.getAllProduct);
admin_route.post("/addProductOffer",adminAuth,productController.addProductOffer);
admin_route.post("/removeProductOffer",adminAuth,productController.removeProductOffer);
admin_route.get("/blockProduct",adminAuth,productController.blockProduct);
admin_route.get("/unblockProduct",adminAuth,productController.unblockProduct);
admin_route.get("/editProduct",adminAuth,productController.geteditProduct);
admin_route.post("/editProduct/:id",adminAuth,upload.array("images",4),productController.editProduct);
admin_route.post('/updateProductImage', upload.single('image'), productController.updateProductImage)







module.exports = admin_route;

