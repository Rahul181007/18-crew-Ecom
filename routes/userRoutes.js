const express=require("express");
const body_parser=require("body-parser");
const multer=require("multer");
const user_route=express();
user_route.set("view engine","ejs");
user_route.set("views","./views/users");
user_route.use(body_parser.json());
user_route.use(body_parser.urlencoded({extended:true}));
const userContoller=require("../controllers/user/userController");
const path = require("path");
const passport = require("passport");
const profileController=require("../controllers/user/profileControllers");
const {userAuth,adminAuth}=require("../middlewares/auth");
const productController=require("../controllers/user/productController");

// ..storage area for image
const storage=multer.diskStorage({
    destination: function(req,file,cb){
        cb(null,path.join(__dirname,"../public/userimage"))
    },
    filename:function(req,file,cb){
        const name=Date.now()+"-"+file.originalname;
        cb(null,name)
    }
})
const upload=multer({storage:storage})

// signup management
user_route.get("/register",userContoller.loadRegister);
user_route.post("/register",userContoller.insertUser);
user_route.post("/verify-otp",userContoller.verifyOtp) 
user_route.post("/resend-otp",userContoller.resendOTP)
user_route.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))
user_route.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/register"}),(req,res)=>{
    console.log('this is user',req.user)
    req.session.user=req.user
    res.redirect("/");
    
})
// sign in Management
user_route.get("/signin",userContoller.loadLogin)
user_route.post("/signin",userContoller.login)
//homepage  and shopping page
user_route.get("/",userContoller.loadhomepage);
user_route.get("/logout",userAuth,userContoller.logout);
user_route.get("/shop",userContoller.loadShoppingPage);
user_route.get("/filter",userContoller.filterProduct)
user_route.get("/filterPrice",userContoller.filterPrice);
user_route.post("/search",userContoller.searchProduct);
// profileMangement
user_route.get("/forgot-password",profileController.getForgotPassPage)
user_route.post("/forgotEmailValid",profileController.forgotEmailValid);
user_route.post("/verifyPassForgot-otp",profileController.verifyForgotPassOtp);
user_route.get("/reset-password",profileController.getresetPassword);
user_route.post("/resend-forgot-otp",profileController.resendOTP);
user_route.post("/reset-password",profileController.postResetPassword);
user_route.get("/userProfile",profileController.userProfile);
user_route.get("/change-email",userAuth,profileController.changeEmail);
user_route.post("/change-email",userAuth,profileController.changeEmailValid)
user_route.post("/verifyChangeEmail-otp",userAuth,profileController.verifyChangeEmailOtp);
user_route.get("/reset-email",userAuth,profileController.getResetEmailPage);
user_route.post("/update-email",userAuth,profileController.updateEmail);
user_route.get("/change-password",userAuth,profileController.changePassword);
// user_route.post("/change-password",userAuth,profileController.)

// product details
user_route.get("/productDetails",productController.productDetails);



// .........pagenot found.........
user_route.get("/pageNotFound",userContoller.pageNotFound);
user_route.get("/*")

module.exports=user_route;