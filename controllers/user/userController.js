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
const SearchHistory=require("../../models/searchHistorySchema");
const { logWalletTransaction } = require("../../utils/wallet");
const { WalletSources, TransactionTypes } = require("../../constants/walletConstants");

// generate unique referal code
function generateRefferalcode(){
  return 'REF'+crypto.randomBytes(4).toString('hex').toUpperCase();
};



// ...........loadRegister form...........
const loadRegister=async(req,res,next)=>{
    try {
        res.render("registeration")
    } catch (error) {
        next(error)
    }
}
//............home page..................
const loadhomepage = async (req, res,next) => {
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
      next(error)
    }
  };
  

// ..........making password hashing.......
const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10);
        return passwordHash;
    } catch (error) {
        console.log(error.message)
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
 const insertUser=async(req,res,next)=>{
   
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
        next(error)
        
    }
 }
// ..............verify otp...............
const verifyOtp = async (req, res,next) => {
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
  if (referrer) {
    // Referrer: add ₹100 referral bonus
    referrer.wallet = (referrer.wallet || 0) + 100;
    await logWalletTransaction(
      referrer._id,
      TransactionTypes.CREDIT,
      100,
      WalletSources.REFERRAL_BONUS,
      `Referral signup by ${saveUserData.email}`
    );
    await referrer.save();

    // Referred User: add ₹50 signup bonus
    saveUserData.wallet = 50;
    await logWalletTransaction(
      saveUserData._id,
      TransactionTypes.CREDIT,
      50,
      WalletSources.REFERRAL_SIGNUP,
      `Referred by ${referrer.email}`
    );
  }
}


      req.session.user = saveUserData.id;
      res.json({ success: true, redirectUrl: "/" });

    } else {
      res.status(400).json({ success: false, message: "Invalid OTP: please try again" });
    }

  } catch (error) {
    next(error);
  }
};

// ...............resend OTP..............
const resendOTP=async(req,res,next)=>{
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
        next(error)
    }
}

// ...........pagenot found...............
const pageNotFound=async (req,res,next)=>{
    try {
        res.render("page-404");
    } catch (error) {
        next(error)
    }
}

const loadLogin=async(req,res,next)=>{
    try {
        if(!req.session.user){
            return res.render("signin")
        }else{
            res.redirect("/")
        }
    } catch (error) {
        next(error)
    }
}

const login = async (req, res,next) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      return res.render("signin", { message: "User not Found" });
    }
    if (findUser.isBlocked) {
      return res.render("signin", { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("signin", { message: "Incorrect credentials" });
    }

    req.session.user = findUser._id;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.render("signin", { message: "Session error. Please try again." });
      }
      res.redirect("/");
    });

  } catch (error) {
    next(error)
  }
};


// ..........logout.................
const logout=async(req,res,next)=>{
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
        next(error)
    }

}

const loadShoppingPage = async (req, res,next) => {
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
    next(error)
  }
};

const filterProduct = async (req, res,next) => {
  try {
    const user = req.session.user;
    const categoryId = req.query.category || '';
    const brandId = req.query.brand || '';
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 10;
    const cart = await Cart.findOne({ userId: user });
    let cartCount = cart?.items?.length || 0;

    const query = { isBlocked: false };

    // Find category and brand
    const findCategory = categoryId ? await Category.findOne({ _id: categoryId }) : null;
    const findBrand = brandId ? await Brand.findOne({ _id: brandId }) : null;

    if (findCategory) query.category = findCategory._id;
    if (findBrand) query.brand = findBrand.brandName;

    // Get products with pagination
    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .lean();

    const totalPages = Math.ceil(totalProducts / itemsPerPage);

    // Save search history if user is logged in
    if (user && (findCategory || findBrand)) {
      await SearchHistory.create({
        userId: user,
        categories: findCategory ? [findCategory._id] : [],
        brand: findBrand ? findBrand._id : null,
        searchOn: new Date()
      });
    }

    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    res.render('collection', {
      user: user ? await User.findById(user) : null,
      products,
      category: categories,
      brand: brands,
      currentPage,
      totalPages,
      selectedCategory: categoryId || null,
      selectedBrand: brandId || null,
      cartCount,
      wishlistCount: user ? (await User.findById(user))?.wishlist?.length || 0 : 0,
      page: "shop"
    });
  } catch (error) {
    next(error)
  }
};

const filterPrice = async (req, res,next) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const sort = req.query.sort || '';
    const cart = await Cart.findOne({ userId: user });
    let cartCount = cart?.items?.length || 0;

    let query = { isBlocked: false };
    const categories = await Category.find({ isListed: true });
    query.category = { $in: categories.map(c => c._id) };

    // Sorting options
    const sortOptions = {
      'Low-to-High': { salePrice: 1 },
      'High-to-Low': { salePrice: -1 },
      'name-asc': { productName: 1 },
      'name-desc': { productName: -1 },
      'default': { createdAt: -1 }
    };
    const sortOption = sortOptions[sort] || sortOptions['default'];

    const [products, totalProducts, brands] = await Promise.all([
      Product.find(query)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
      Brand.find({ isBlocked: false })
    ]);

    const totalPages = Math.ceil(totalProducts / limit) || 1;

    res.render('collection', {
      user: user ? await User.findById(user) : null,
      products,
      category: categories.map(c => ({ _id: c._id, name: c.name })),
      brand: brands,
      totalProducts,
      currentPage: page,
      totalPages,
      cartCount,
      wishlistCount: user ? (await User.findById(user))?.wishlist?.length || 0 : 0,
      page: 'shop',
      sort,
    });
  } catch (error) {
    next(error)
  }
};

const searchProduct = async (req, res,next) => {
  try {
    const user = req.session.user;
    const search = req.body.query?.trim();
    if (!search) return res.redirect('/collection');

    const cart = await Cart.findOne({ userId: user });
    let cartCount = cart?.items?.length || 0;

    // Get categories and brands in parallel
    const [categories, brands] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }).lean()
    ]);

    // Search products
    let searchResult = req.session.filteredProducts?.length > 0
      ? req.session.filteredProducts.filter(p => 
          p.productName.toLowerCase().includes(search.toLowerCase()))
      : await Product.find({
          productName: { $regex: search, $options: "i" },
          isBlocked: false,
          category: { $in: categories.map(c => c._id) }
        });

    // Sort by newest first
    searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Save search history if user is logged in
    if (user) {
      await SearchHistory.create({
        userId: user,
        keywords: [search],
        searchOn: new Date()
      });
    }

    // Pagination
    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const totalPages = Math.ceil(searchResult.length / itemsPerPage);
    const currentProduct = searchResult.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );

    res.render("collection", {
      user: user ? await User.findById(user) : null,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
      count: searchResult.length,
      cartCount,
      wishlistCount: user ? (await User.findById(user))?.wishlist?.length || 0 : 0,
      page: "shop"
    });
  } catch (error) {
    next(error)
  }
};
 
const copyReferralCode=async(req,res,next)=>{
  try {
    const user=await User.findById(req.session.user||req.session.user._id);
    if(!user){
      return res.status(400).json({success:false,message:'Unauthorized'})
    }
    res.json({success:true,referalCode:user.referalCode})
  } catch (error) {
        next(error)
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