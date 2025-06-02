const { error, log } = require("console")
const User=require("../../models/userSchema");
const Category= require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/brandSchema")
const bcrypt=require("bcrypt");
const nodemailer=require("nodemailer");
const env=require("dotenv").config();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Cart=require("../../models/cartSchema");
const Coupon=require("../../models/couponSchema")
 const crypto=require('crypto');


// generate unique referal code
function generateRefferalcode(){
  return 'REF'+crypto.randomBytes(4).toString('hex').toUpperCase();
};



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
const loadhomepage = async (req, res) => {
    try {
      const user = req.session.user;
      const cartCount=0;
      
      const userData = await User.findOne({ _id: user });
      const category = await Category.find({ isListed: true });
      const cart = await Cart.findOne({ userId: user });
      let productData = await Product.find({
        isBlocked: false,
        category: { $in: category.map((cat) => cat._id) },
        
      });
  
      productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      productData = productData.slice(0, 5);
      console.log(user)
      
    
      if (user) {
        res.render("homepage", {
          user: userData,
          products: productData,
          category: category ,
           cartCount: cart && cart.items ? cart.items.length : 0,
           wishlistCount : userData?.wishlist?.length ?? req.user?.wishlist?.length ?? 0
        });
      } else {
        res.render("homepage", {
          products: productData,
          category: category,
          cartCount: cart && cart.items ? cart.items.length : 0,
          wishlistCount : userData?.wishlist?.length ?? req.user?.wishlist?.length ?? 0
        });
      }
    } catch (error) {
      console.log(error);
      res.status(500).send("server error");
    }
  };
  

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
        
        const {name,email,mobile,password,gender,referralCode}=req.body;
        
        const findUser=await User.findOne({email});
        if(findUser){
            return res.render("registeration",{message:"User with email already exist"})
        }

        let referrer=null;
        if(referralCode && referralCode.trim()){
          referrer=await User.findOne({referalCode:referralCode});
          if(!referrer){
            return res.render("registeration",{message:"Invalid referral code"})
          }
        }
         const otp=generateOtp();
         
         const emailSent=await sendVerificationEmail(email,otp)
         if(!emailSent){
            return res.json("email-error")
         }
       req.session.userOtp=otp;
       req.session.userData={name,email,password,mobile,gender,referralCode:referralCode||null}

       res.render("verify-otp");
       console.log("OTP sent")
    }catch(error){
        console.log("error signup",error.message);
        res.redirect("/pageNotFOUND")
        
    }
 }
// ..............verify otp...............
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      console.log(user)
      const passwordHash = await securePassword(user.password);

      // generate unique referral code for new user
      let referralCode;
      let unique = false;
      while (!unique) {
        referralCode = generateRefferalcode();
        const existingUser = await User.findOne({ referralCode });
        if (!existingUser) unique = true;
      }

      const saveUserData = new User({
        name: user.name,
        email: user.email,
        password: passwordHash,
        mobile: user.mobile,
        gender: user.gender,
        wallet: user.referralCode ? 50 : 0,
        redeemed: !!user.referralCode,
        redeemedUser: user.referralCode
          ? (await User.findOne({ referralCode: user.referralCode }))?._id
          : null,
        referalCode:referralCode,
      });
      await saveUserData.save();

      if (user.referralCode) {
        const referrer = await User.findOne({ referalCode: user.referralCode });
        console.log(referrer)
        if (referrer) {
          referrer.wallet = (referrer.wallet || 0) + 100;
          referrer.walletTransactions.push({
            type: "credit",
            amount: 100,
            source: "Referral bonus",
            reference: `Referred user: ${saveUserData.email}`,
          });
          await referrer.save();

          saveUserData.walletTransactions.push({
            type: "credit",
            amount: 50,
            source: "Referral signup bonus",
            reference: `Referred by: ${referrer.email}`,
          });
          await saveUserData.save();
        }
      }

      req.session.user = saveUserData.id;
      res.json({ success: true, redirectUrl: "/" });

    } else {
      res.status(400).json({ success: false, message: "Invalid OTP: please try again" });
    }

  } catch (error) {
    console.error("Error verifying OTP", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

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

const loadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true });
    const cart = await Cart.findOne({ userId: user });
    let cartCount=0
    cartCount = cart && cart.items ? cart.items.length : 0;
    const categoryIds = categories.map((category) => category._id.toString());
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    console.log('Page:', page, 'Skip:', skip, 'Limit:', limit);
    console.log('Categories:', categories.length, 'Category IDs:', categoryIds);

    const products = await Product.find({
      isBlocked: false,
      category: { $in: categoryIds },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      category: { $in: categoryIds },
    });
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    console.log('Products:', products.length, 'Total Products:', totalProducts, 'Total Pages:', totalPages);

    const brands = await Brand.find({ isBlocked: false });
    console.log('Brands fetched in loadShoppingPage:', brands);

    const categoriesWithIds = categories.map((category) => ({
      _id: category._id,
      name: category.name,
    }));

    if (products.length === 0 && page > 1) {
      console.warn(`No products found for page ${page}`);
    }

    res.render('collection', {
      user: userData || null,
      products,
      category: categoriesWithIds,
      brand: brands,
      totalProducts,
      currentPage: page,
      totalPages,
      cartCount,
      wishlistCount: userData?.wishlist?.length ?? 0,
      page: 'shop',
      activeCategory: '',
      activeBrand: '',
    });
  } catch (error) {
    console.error('Error in loadShoppingPage:', error);
    res.redirect('/pageNotFound');
  }
};

const filterProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const categoryId = req.query.category || '';
    const brandId = req.query.brand || '';
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 10;
   const cart = await Cart.findOne({ userId: user });
    let cartCount=0
    cartCount = cart && cart.items ? cart.items.length : 0;


    const query = { isBlocked: false };

    const findCategory = categoryId ? await Category.findOne({ _id: categoryId }) : null;
    if (findCategory) {
      query.category = findCategory._id;
    }

    const findBrand = brandId ? await Brand.findOne({ _id: brandId }) : null;
    if (findBrand) {
      query.brand = findBrand.brandName;
    }

    let products = await Product.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const currentProducts = products.slice(startIndex, endIndex);

    let userData = null;
    if (user) {
      userData = await User.findOne({ _id: user });
      if (userData) {
        const searchEntry = {
          category: findCategory ? findCategory._id : null,
          brand: findBrand ? findBrand._id : null,
          searchedOn: new Date(),
        };
        userData.searchHistory.push(searchEntry);
        await userData.save();
      }
    }

    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });
    console.log('Brands fetched in filterProduct:', brands);

    res.render('collection', {
      user: userData,
      products: currentProducts,
      category: categories,
      brand: brands,
      currentPage,
      totalPages,
      selectedCategory: categoryId || null,
      selectedBrand: brandId || null,
      cartCount,
      wishlistCount: userData?.wishlist?.length ?? 0,
      page: "shop"
    });
  } catch (error) {
    console.error('Error in filterProducts:', error);
    res.status(500).render('error', { 
      message: 'Error filtering products',
      error: process.env.NODE_ENV === 'development' ? error : null 
    });
  }
};

const filterPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '';
    const cart = await Cart.findOne({ userId: user });
    let cartCount=0
    cartCount = cart && cart.items ? cart.items.length : 0;



    let query = { isBlocked: false };
    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map((category) => category._id.toString());
    query.category = { $in: categoryIds };

    let sortOption = { createdAt: -1 };
    if (sort === 'Low-to-High') {
      sortOption = { salePrice: 1 };
    } else if (sort === 'High-to-Low') {
      sortOption = { salePrice: -1 };
    } else if (sort === 'name-asc') {
      sortOption = { productName: 1 };
    } else if (sort === 'name-desc') {
      sortOption = { productName: -1 };
    }

    console.log('Sort Query:', query, 'Sort Option:', sortOption, 'Page:', page);

    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit) || 1;

    console.log('Sorted Products:', products.length, 'Total:', totalProducts);

    const brands = await Brand.find({ isBlocked: false });
    console.log('Brands fetched in filterPrice:', brands);

    const categoriesWithIds = categories.map((category) => ({
      _id: category._id,
      name: category.name,
    }));

    res.render('collection', {
      user: userData || null,
      products,
      category: categoriesWithIds,
      brand: brands,
      totalProducts,
      currentPage: page,
      totalPages,
      cartCount,
      wishlistCount: userData?.wishlist?.length ?? 0,
      page: 'shop',
      sort,
    });
  } catch (error) {
    console.error('Error in filterPrice:', error);
    res.redirect('/pageNotFound');
  }
};

const searchProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findById(user);
    let search = req.body.query;
    const cart = await Cart.findOne({ userId: user });
    let cartCount=0
    cartCount = cart && cart.items ? cart.items.length : 0;


    const brands = await Brand.find({ isBlocked: false }).lean();
    console.log('Brands fetched in searchProduct:', brands);

    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map(category => category._id);
    let searchResult = [];
    if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
      searchResult = req.session.filteredProducts.filter(product =>
        product.productName.toLowerCase().includes(search.toLowerCase())
      );
    } else {
      searchResult = await Product.find({
        productName: { $regex: ".*" + search + ".*", $options: "i" },
        isBlocked: false,
        category: { $in: categoryIds }
      });
    }
    searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(searchResult.length / itemsPerPage);
    const currentProduct = searchResult.slice(startIndex, endIndex);

    res.render("collection", {
      user: userData,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
      count: searchResult.length,
      cartCount,
      wishlistCount: userData?.wishlist?.length ?? req.user?.wishlist?.length ?? 0,
      page: "shop"
    });
  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};
 
const copyReferralCode=async(req,res)=>{
  try {
    const user=await User.findById(req.session.user||req.session.user._id);
    if(!user){
      return res.status(400).json({success:false,message:'Unauthorized'})
    }
    res.json({success:true,referalCode:user.referalCode})
  } catch (error) {
        console.error('Copy referral code error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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
    loadShoppingPage,
    filterProduct,
    filterPrice,
    searchProduct, copyReferralCode
}