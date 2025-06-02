const User=require("../../models/userSchema");
const nodemailer=require("nodemailer");
const bcrypt=require("bcrypt");
const env=require("dotenv").config();
const session=require("express-session");
const Address=require("../../models/addressSchema");
const { name } = require("ejs");
const Order=require("../../models/orderSchema");
const Cart=require("../../models/cartSchema");

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

const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const addressData = await Address.findOne({ userId: userId });
    const orderData = await Order.find({ userId: userId });
    const cart = await Cart.findOne({ userId });
    let cartCount = 0;
    cartCount = cart && cart.items ? cart.items.length : 0;

    // Derive referrals for EJS compatibility
    const referrals = await User.find({ redeemedUser: userId })
      .select('name createdOn')
      .lean()
      .then(users => users.map(ref => ({
        name: ref.name,
        date: ref.createdOn,
        status: 'completed' // Assuming successful signup means completed
      })));

    // No coupons generated, so return empty referralCoupons
    const referralCoupons = [];

    res.render('profile', {
      user: {
        ...userData._doc,
        referralCode: userData.referalCode, // Map referalCode to referralCode for EJS
        referrals, // Derived referrals
        referralCoupons // Empty coupons
      },
      userAddress: addressData || { address: [] },
      order: orderData,
      cartCount,
      wishlistCount: userData?.wishlist?.length ?? req.user?.wishlist?.length ?? 0,
      page: 'profile'
    });
  } catch (error) {
    console.error("Error for retrieve profile data", error);
    res.redirect("/pageNotFound");
  }
};

// change - email

const changeEmail=async(req,res)=>{
    try {
       res.render("change-email") ;
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }

}
const changeEmailValid=async(req,res)=>{
 try {
    const {email}=req.body
    const findUser=await User.findOne({email:email});
    if(!findUser){
        res.render("change-email",{
            message:"user with this email not found"
        })
    }else{
        const otp= generateOtp();
        const emailSent=await sendVerificationEmail(email,otp);
        if(emailSent){
            req.session.userOtp=otp;
            req.session.email=email;
            req.session.userData=req.body;
            res.render("change-email-otp");
            console.log("emailsent email:",email);
            console.log("emailsent otp:",otp);

        }else{
            res.json({status:false,message:"Failed send OTP. Please try again later"}) 
        }
    }

 } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound")
 }
}

const verifyChangeEmailOtp = async (req, res) => {
    try {
      const otpInput = req.body.otp;
      const sessionOtp = req.session.userOtp;
      console.log('Input OTP:', otpInput);
      console.log('Session OTP:', sessionOtp);
  
      if (!sessionOtp) {
        return res.json({ status: false, message: 'No OTP found in session. Please request a new OTP.' });
      }
  
      if (otpInput === sessionOtp) {
        res.json({ status: true });
      } else {
        res.json({ status: false, message: 'OTP does not match.' });
      }
    } catch (error) {
      console.error('Error in verifyChangeEmailOtp:', error);
      return res.status(500).json({
        status: false,
        message: 'An error occurred. Please try again.',
      });
    }
  };
  
  const getResetEmailPage=async(req,res)=>{
    try {
      res.render("new-email",{
        userData:req.session.userData
      })  
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }
  }
// update email
const updateEmail=async(req,res)=>{
    try {
        const {email}=req.body;
        const userId=req.session.user
        const alreadyExist=await User.findOne({email:email});
        if(alreadyExist){
            res.render("new-email",{
                message:"user already exist",
                
            })
        }else{
            await User.findByIdAndUpdate({_id:userId},{email:email})
            res.redirect("/userProfile"); 
        }
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }
}





// change-password
const changePassword=async(req,res)=>{
  try {
    res.render("change-password")
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound")
  }
}

const changePassValid=async(req,res)=>{
    try {
       const {email}=req.body;
       const findUser=await User.findOne({email:email});
       if(!findUser){
        res.render("change-password",{
            message:"User not found"
        })
       }else{
        const otp=generateOtp();
        const emailSent=await sendVerificationEmail(email,otp);
        if(emailSent){
            req.session.userOtp=otp;
            req.session.email=email;
            req.session.userData=req.body;
            res.render("change-pass-otp");
            console.log("otp is ",otp);
            console.log("email",email);
        }else{
            res.json({status:false,message:"Failed send OTP. Please try again later"}) 
        }
       }
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound");
    }
}

const verifyChangePassOtp=async(req,res)=>{
 try {
    const otpInput=req.body.otp;
    const sessionOtp=req.session.userOtp;
    console.log("otp:",otpInput);
    console.log("session Otp",sessionOtp)
    if(!sessionOtp){
      return res.json({ status: false, message: 'No OTP found in session. Please request a new OTP.' });
    }
    if(otpInput===sessionOtp){
      res.json({status:true});
      
    }else{
      res.json({status:false,message:"Otp doesnot match"})
    }
 } catch (error) {
    console.error('Error in verifyChangePassOtp:', error);
    return res.status(500).json({
      status: false,
      message: 'An error occurred. Please try again.',
    });
 }
}


const getResetPassPage=async(req,res)=>{
    try {
        res.render("new-pass",{
            userData:req.session.userData
        })
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }
}

const updatePass=async(req,res)=>{
try {
    const {newPass1,newPass2}=req.body;
    const email = req.session.email;
    if(newPass1===newPass2){
      const hashPassword=await securePassword(newPass1);
      await User.updateOne({email:email},{$set:{password:hashPassword}})
      res.redirect("/signin")
    }else{
      res.render("Update-pass",{message:"Password donot match"})
    }
} catch (error) {
    console.log(error);
    res.redirect("/pageNotFound")
}
}

//  update profile
const updateProfile = async (req, res) => {
  try {
    
    const { name,  mobile } = req.body;
   console.log(req.file)
    const id=req.session.user
    const image = req.file ? req.file.filename : null;

    const findUser = await User.findOne({_id:id });
    if (findUser) {
      const updateData = {
        name: name,
        mobile: mobile
      };
      
      if (image) {
        updateData.image = image;
      }

      await User.findByIdAndUpdate(id, { $set: updateData });
      res.redirect("/userProfile");
    } else {
     
      res.redirect("/pageNotFound");
    }
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
}

// address Mangement
 
const addAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId });
    let cartCount=0
    cartCount = cart && cart.items ? cart.items.length : 0;
    if (!userId) {
      return res.redirect("/signin"); //
    }

    const userData = await User.findById(userId);
    if (!userData) {
      return res.redirect("/pageNotFound");
    }

    res.render("add-address", {
      user: userData,
      cartCount,
      wishlistCount: userData?.wishlist?.length ?? req.user?.wishlist?.length ?? 0,
    });
  } catch (error) {
    console.error("Error in addAddress:", error);
    res.redirect("/pageNotFound");
  }
};

const postAddAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/signin");
    }

    const userData = await User.findOne({ _id: userId });
    if (!userData) {
      return res.redirect("/pageNotFound");
    }

    const { addressType, name, city, landMark, state, pincode, mobile, altMobile } = req.body;

    // Validate required fields
    if (!addressType || !name || !city || !state || !pincode || !mobile) {
      return res.status(400).render("add-address", {
        user: userData,
        cartCount: userData?.cart?.length ?? 0,
        wishlistCount: userData?.wishlist?.length ?? 0,
        error: "Please fill in all required fields.",
      });
    }

    let userAddress = await Address.findOne({ userId: userData._id });

    if (!userAddress) {
      userAddress = new Address({
        userId: userData._id,
        address: [{ addressType, name, city, landMark, state, pincode, mobile, altMobile }],
      });
    } else {
      userAddress.address.push({ addressType, name, city, landMark, state, pincode, mobile, altMobile });
    }

    await userAddress.save();
    res.redirect("/userProfile");
  } catch (error) {
    console.error("Error in postAddAddress:", error);
    res.redirect("/pageNotFound");
  }
};

const editAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/signin");
    }
    const cart = await Cart.findOne({ userId });
    let cartCount=0
    cartCount = cart && cart.items ? cart.items.length : 0;

    const userData = await User.findById(userId);
    if (!userData) {
      return res.redirect("/pageNotFound");
    }

    const { id: addressId, index } = req.query;
    if (!addressId || index === undefined) {
      return res.redirect("/pageNotFound");
    }

    const currAddress = await Address.findOne({ _id: addressId, userId });
    if (!currAddress) {
      return res.redirect("/pageNotFound");
    }

    const addressIndex = parseInt(index);
    if (isNaN(addressIndex) || !currAddress.address[addressIndex]) {
      return res.redirect("/pageNotFound");
    }

    const addressData = currAddress.address[addressIndex];

    // Determine the source from the referer header
    const referer = req.headers.referer || "";
    const source = referer.includes("/checkout") ? "checkout" : "userProfile";

    res.render("edit-address", {
      address: addressData,
      addressId,
      addressIndex,
      user: userData,
      cartCount,
      wishlistCount: userData?.wishlist?.length ?? req.user?.wishlist?.length ?? 0,
      source, // Pass the source to the form
    });
  } catch (error) {
    console.error("Error in editAddress:", error);
    res.redirect("/pageNotFound");
  }
};

const postEditAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/signin");
    }

    const { addressId, addressIndex, addressType, name, city, landMark, state, pincode, mobile, altMobile, source } = req.body;

    if (!addressId || addressIndex === undefined) {
      return res.redirect("/pageNotFound");
    }

    // Validate required fields
    if (!addressType || !name || !city || !state || !pincode || !mobile) {
      const userData = await User.findById(userId);
      if (!userData) {
        return res.redirect("/pageNotFound");
      }
      return res.status(400).render("edit-address", {
        address: { addressType, name, city, landMark, state, pincode, mobile, altMobile },
        addressId,
        addressIndex,
        user: userData,
        cartCount: userData?.cart?.length ?? 0,
        wishlistCount: userData?.wishlist?.length ?? 0,
        source, // Pass source back to the form in case of validation error
        error: "Please fill in all required fields.",
      });
    }

    const findAddress = await Address.findOne({ _id: addressId, userId });
    if (!findAddress) {
      return res.redirect("/pageNotFound");
    }

    const index = parseInt(addressIndex);
    if (isNaN(index) || !findAddress.address[index]) {
      return res.redirect("/pageNotFound");
    }

    // Update the specific address in the array
    findAddress.address[index] = {
      addressType,
      name,
      city,
      landMark,
      state,
      pincode,
      mobile,
      altMobile,
    };

    // Save the updated address
    await findAddress.save();

    // Redirect based on source
    if (source === "checkout") {
      return res.redirect("/checkout");
    } else {
      return res.redirect("/userProfile");
    }
  } catch (error) {
    console.error("Error in postEditAddress:", error);
    if (!res.headersSent) {
      return res.redirect("/pageNotFound");
    }
  }
};


const deleteAddress=async(req,res)=>{
  try {
    const addressId=req.query.id;
    console.log("Address ID:", addressId);
    const findAddress=await Address.findOne({"address._id":addressId});
    if(!findAddress){
      return res.status(404).send("Address not found")
    }
    await Address.updateOne({
      "address._id":addressId
    },{$pull:{
      address:{_id:addressId}
    }}
  )
  res.redirect("/userProfile")
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound")
  }
}
 const deleteAccn=async(req,res)=>{
 


 try {
    const { password } = req.body;
    const user = await User.findById(req.session.user); 

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    
    if (user.googleId) {
      
      await User.deleteOne({ _id: user._id });
      await Address.deleteMany({ userId: user._id }); 
      await Order.deleteMany({ userId: user._id }); 
      req.session.destroy(); // Destroy the session
      return res.status(200).json({ success: true });
    }

    // Verify password for non-Google users
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    // Delete user data
    await User.deleteOne({ _id: user._id });
    await Address.deleteMany({ userId: user._id }); // Delete associated addresses
    await Order.deleteMany({ userId: user._id }); // Delete associated orders, if applicable

    // Destroy the session to log out the user
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ success: false, message: 'Failed to log out.' });
      }
      return res.status(200).json({ success: true });
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

 const copyReferralCode = async (req, res) => {
  try {
    console.log("hi")
    const user = await User.findById(req.session.user);
    console.log(user)
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    res.json({ success: true, referralCode: user.referalCode });
  } catch (error) {
    console.error('Copy referral code error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
  
};






module.exports={
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getresetPassword,
    resendOTP,
    postResetPassword,
    userProfile,
    changeEmail,
    changePassword,
    changeEmailValid,
    verifyChangeEmailOtp,
    getResetEmailPage,
    updateEmail,
    changePassValid,
    verifyChangePassOtp,
    getResetPassPage,
    updatePass,
    updateProfile,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
   deleteAccn,
   copyReferralCode
    
}