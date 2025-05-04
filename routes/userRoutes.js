const express=require("express");
const body_parser=require("body-parser");
const multer=require("multer");
const user_route=express();
user_route.set("view engine","ejs");
user_route.set("views","./views/users");
user_route.use(body_parser.json());
user_route.use(body_parser.urlencoded({extended:true}));
const userContoller=require("../controllers/userController");
const path = require("path");
const passport = require("passport");
const profileController=require("../controllers/profileControllers");
const {userAuth,adminAuth}=require("../middlewares/auth");

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
    res.redirect("/");
})
// sign in Management
user_route.get("/signin",userContoller.loadLogin)
user_route.post("/signin",userContoller.login)
//homepage  and shopping page
user_route.get("/",userContoller.loadhomepage);
user_route.get("/logout",userContoller.logout)
// profileMangement
user_route.get("/forgot-password",profileController.getForgotPassPage)
user_route.post("/forgotEmailValid",profileController.forgotEmailValid);
user_route.post("/verifyPassForgot-otp",profileController.verifyForgotPassOtp);
user_route.get("/reset-password",profileController.getresetPassword);
user_route.post("/resend-forgot-otp",profileController.resendOTP);
user_route.post("/reset-password",profileController.postResetPassword);
user_route.get("/userProfile",userAuth,profileController.userProfile)

// .........pagenot found.........
user_route.get("/pageNotFound",userContoller.pageNotFound);

module.exports=user_route;