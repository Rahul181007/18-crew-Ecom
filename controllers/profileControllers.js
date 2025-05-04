const User=require("../models/userSchema");
const nodemailer=require("nodemailer");
const bcrypt=require("bcrypt");
const env=require("dotenv").config();
const session=require("express-session");

function generateOtp(){
    const digits='1234567890';
    let otp="";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)]
    }
    return otp
}
const  sendVerificationEmail= async (email,otp)=>{
    try {
        const transporter=nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })
        const mailOptions={
          from:process.env.NODEMAILER_EMAIL,
          to:email,
          subject:"Your Otp for password reset",
          text:`Your OTP is ${otp}`,
          html:`<b><h4>Your OTP :${otp}</h4><br></b>`
        }
    
        const info=transporter.sendMail(mailOptions);
        console.log("email sent", (await info).response);
        return true;
    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
   
}

const securePassword=async(password)=>{
    const passwordHash=await bcrypt.hash(password,10);
    return passwordHash;
}




const getForgotPassPage=async(req,res)=>{
    try {
        res.render("forgot-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const forgotEmailValid=async(req,res)=>{
try {
    const {email}=req.body
   
    const finduser=await User.findOne({email:email});
    if(finduser){
        const otp=generateOtp();
        const emailSent=await sendVerificationEmail(email,otp);
        console.log(emailSent)
        if(emailSent){
            req.session.userOtp=otp;
            req.session.email=email;
            res.render("forgotPass-otp");
            console.log("OTP",otp);
        }else{
            res.json({status:false,message:"Failed send OTP. Please try again later"})
        }
    }else{
        return res.render("forgot-password", {
            message: "User with this mail id does not exist"
        });
        
    }
} catch (error) {
    console.log(error);
    res.redirect("/pageNotFound")
}
}

const verifyForgotPassOtp = async (req, res) => {
    try {
      const otp = req.body.otp;
        console.log(otp)
      if (otp === req.session.userOtp) {
        res.json({ status: true })
      } else {
        return res.json({ status: false, message: "OTP not matching" });
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred. Please try again.",
      });
    }
  };
  
const getresetPassword=async(req,res)=>{
    try {
        res.render("reset-password");
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }
}


const resendOTP=async(req,res)=>{
    try {
        const otp=generateOtp();
        req.session.userOtp=otp;
        const email=req.session.email;
        const emailSent=await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("resend otp",otp);
            res.json({ status: true, message: "OTP resent successfully." });

        }
    } catch (error) {
        console.error("Error resending OTP:", err);
    res.status(500).json({ status: false, message: "Failed to resend OTP." });
    }
}


const postResetPassword = async (req, res) => {
    try {
      const { newPass1, newPass2 } = req.body;
      const email = req.session.email;
      if(newPass1===newPass2){
        const hashPassword=await securePassword(newPass1);
        await User.updateOne({email:email},{$set:{password:hashPassword}})
        res.redirect("/signin")
      }else{
        res.render("reset-password",{message:"Password donot match"})
      }
     
    } catch (error) {
      console.error("Error resetting password:", error);
      res.redirect("/pageNotFound");
    }
  };
  // profile

const userProfile=async(req,res)=>{
    try {
        const userId=req.session.user;
        const userData=await User.findById(userId);
        res.render('profile',{
            user:userData
        })
    } catch (error) {
        console.error("Error for retrive profile data",error);
        res.redirect("/pageNotFound")
    }
}
  

module.exports={
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getresetPassword,
    resendOTP,
    postResetPassword,
    userProfile
}