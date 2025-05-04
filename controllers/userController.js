const { error, log } = require("console")
const User=require("../models/userSchema");
const Category= require("../models/categorySchema");
const Product=require("../models/productSchema");
const bcrypt=require("bcrypt");
const nodemailer=require("nodemailer");
const env=require("dotenv").config




// ...........loadRegister form...........
const loadRegister=async(req,res)=>{
    try {
        res.render("registeration")
    } catch (error) {
        console.log(error)
        res.status(500).send("server error")
    }
}
//............home page..................
const loadhomepage=async(req,res)=>{
    try {
       const user=req.session.user;
      
       const userData=await User.findOne({_id:user});
       const category=await Category.find({isListed:true});
       let productData=await Product.find({
        isBlocked:false,
        category:{$in:category.map(category=>category._id)},
        quantity:{$gt:0}
       })
       productData.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
       productData=productData.slice(0,5);

      if(user){
        res.render("homepage",{user:userData,products:productData})
      }else{
        res.render("homepage",{products:productData})
      }
      


    } catch (error) {
        console.log(error);
        res.status(500).send("server error")
    }
}

// ..........making password hashing.......
const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10);
        return passwordHash;
    } catch (error) {
        console.log(error,message)
    }
}
// ......generate Otp...........
function generateOtp(){
    return Math.floor(100000+ Math.random()*900000).toString();

}
// ........sendverification mail
async function sendVerificationEmail(email,otp){
 try {
    
   const transporter=nodemailer.createTransport({
    service:"gmail",
    port:587,
    secure:false,
    requireTLS:true,
    auth:{
       user:process.env.NODEMAILER_EMAIL,
       pass: process.env.NODEMAILER_PASSWORD
    }
   })
    const info=await transporter.sendMail({
        from:process.env.NODEMAILE_EMAIL,
        to:email,
        subject:"Verify your account",
        text:`Your OTP is ${otp}`,
        html:`<b>Your OTP: ${otp}</b>`

    })
 return info.accepted.length>0
 } catch (error) {
    console.error("Error sending email",error)
    return false
 }
}



// ............insert User................
 const insertUser=async(req,res)=>{
   
    try{
        console.log(req.body)
        const {name,email,mobile,password,gender}=req.body;
    
        

        const findUser=await User.findOne({email});
        if(findUser){
            return res.render("registeration",{message:"User with email already exist"})
        }
         const otp=generateOtp();
         
         const emailSent=await sendVerificationEmail(email,otp)
         if(!emailSent){
            return res.json("email-error")
         }
       req.session.userOtp=otp;
       req.session.userData={name,email,password,mobile,gender}

       res.render("verify-otp");
       console.log("OTP sent")
    }catch(error){
        console.log("error signup",error.message);
        res.redirect("/pageNotFOUND")
        
    }
 }
// ..............verify otp...............
const verifyOtp=async(req,res)=>{
    try {
        const {otp}=req.body;
        if(otp===req.session.userOtp){
            const user=req.session.userData;
            const passwordHash=await securePassword(user.password);

            const saveUserData=new User({
                name:user.name,
                email:user.email,
                password:passwordHash,
                mobile:user.mobile,
                image:user.image,
                gender:user.gender
            })
            await saveUserData.save();
            req.session.user=saveUserData.id;
            res.json({success:true, redirectUrl:"/"})

        }else{
           res.status(400).json({success:false,message:"Invalid OTP: please try again"})
        }
        
    } catch (error) {
        console.error("Error verifying OTP",error);
        res.status(500).json({success:false,message:"An error occured"})
    }
}
// ...............resend OTP..............
const resendOTP=async(req,res)=>{
    try {
        const {email}=req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }

        const otp=generateOtp();
        req.session.userOtp=otp;

        const emailSent=await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log("resend OTP ",otp)
            res.status(200).json({success:true,message:"OTP resend successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to recent otp. please try again"})
        }
    } catch (error) {
        console.error("Error resending Otp",error)
        res.status(500).json({success:false,message:"Internal server error please try again"})
    }
}

// ...........pagenot found...............
const pageNotFound=async (req,res)=>{
    try {
        res.render("page-404");
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }
}

const loadLogin=async(req,res)=>{
    try {
        if(!req.session.user){
            return res.render("signin")
        }else{
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("/pageNotFOUND")
    }
}

const login=async(req,res)=>{
    try {
        const {email,password}=req.body;
        const findUser=await User.findOne({isAdmin:0,email:email});
       
        if(!findUser){
            return res.render("signin",{message:"User not Found"})
        }
        if(findUser.isBlocked){
            return res.render("signin",{message:"User is blocked by admin"})
        }
        
        const passwordMatch=await bcrypt.compare(password,findUser.password)
        if(!passwordMatch){
            return res.render("signin",{message:"Incorrect credentials"})
        }
        
        req.session.user=findUser._id;
        res.redirect("/")



    } catch (error) {
        console.error("signin error",error);
        res.render("signin",{message:"signin failed. Please try again later"})
    }
}

// ..........logout.................
const logout=async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("session destruction error",err.message);
                return res.redirect("/pageNotFound");
            }else{
                return res.redirect("/signin")
            }
        })
    
    } catch (error) {
        console.log("Logout error",error)
         res.redirect("/pageNotFound")
    }

}


module.exports={
    loadRegister,
    loadhomepage,
    insertUser,
    verifyOtp,
    resendOTP,
    loadLogin,
    login,
    logout,
    pageNotFound,
    
}