const { error, log } = require("console")
const User=require("../../models/userSchema");
const Category= require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/brandSchema")
const bcrypt=require("bcrypt");
const nodemailer=require("nodemailer");
const env=require("dotenv").config();




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
      console.log(user)
      const userData = await User.findOne({ _id: user });
      const category = await Category.find({ isListed: true });
  
      let productData = await Product.find({
        isBlocked: false,
        category: { $in: category.map((cat) => cat._id) },
        quantity: { $gt: 0 }
      });
  
      productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      productData = productData.slice(0, 5);
    
      if (user) {
        res.render("homepage", {
          user: userData,
          products: productData,
          category: category 
        });
      } else {
        res.render("homepage", {
          products: productData,
          category: category 
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
        console.log(req.session.user);
        
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

const loadShoppingPage=async(req,res)=>{
    try {
        const user=req.session.user;
        const userData=await User.findOne({_id:user});
        const categories=await Category.find({isListed:true});
        const categoryIds=categories.map((category)=>category._id.toString());
        const page=parseInt(req.query.page)||1
        const limit=12;
        const skip=(page-1)*limit;
        const products=await Product.find({
            isBlocked:false,
            category:{$in:categoryIds},
            quantity:{$gt:0}
        }).sort({createdAt:-1}).skip(skip).limit(limit)
        const totalProducts=await Product.countDocuments({
            isBlocked:false,
            category:{$in:categoryIds},
            quantity:{$gt:0}
        });
        const totalPages=Math.ceil(totalProducts/limit);
        const brands=await Brand.find({isBlocked:false});
        const categoriesWithIds=categories.map(category=>({_id:category._id,name: category.name,}))




        res.render("collection",{
            user:userData,
            products:products,
            category:categoriesWithIds,
            brand:brands,
            totalProducts:totalProducts,
            currentPage:page,
            totalPages:totalPages
                })
    } catch (error) {
        console.log(error)
        res.redirect("/pageNotFound")
    }
}


const filterProduct = async (req, res) => {
    try {
      const user = req.session.user; // Get logged-in user ID from session
      const category = req.query.category; // Get category ID from query string
      const brand = req.query.brand;       // Get brand ID from query string
  
      // If category/brand are present, fetch their full document from DB
      const findCategory = category ? await Category.findOne({ _id: category }) : null;
      const findBrand = brand ? await Brand.findOne({ _id: brand }) : null;
  
      // Get all brands to show in filter UI
      const brands = await Brand.find({}).lean();
  
      // Build the base query to find active, in-stock products
      const query = {
        isBlocked: false,
        quantity: { $gt: 0 }
      };
  
      if (findCategory) query.category = findCategory._id; // Filter by category if valid
      if (findBrand) query.brand = findBrand.brandName;    // Filter by brand name if valid
  
      // Find all matching products
      let findProducts = await Product.find(query).lean();
  
      // Sort by latest created first
      findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
      // Get all listed categories (for filter UI)
      const categories = await Category.find({ isListed: true });
  
      // Pagination setup
      const itemsPerPage = 6;
      const currentPage = parseInt(req.query.page) || 1;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
  
      const totalPages = Math.ceil(findProducts.length / itemsPerPage);
      const currentProduct = findProducts.slice(startIndex, endIndex); // Paginate products
  
      let userData = null;
  
      // If user is logged in, fetch full user data
      if (user) {
        userData = await User.findOne({ _id: user });
  
        if (userData) {
          // Save the search filter into user's search history
          const searchEntry = {
            category: findCategory ? findCategory._id : null,
            brand: findBrand ? findBrand.brandName : null,
            searchedOn: new Date()
          };
          userData.searchHistory.push(searchEntry);
          await userData.save();
        }
      }
  
      // Save filtered result in session (optional use)
      req.session.filteredProducts = currentProduct;
  
      // Render the filtered product view
      res.render("collection", {
        user: userData,
        products: currentProduct,
        category: categories,
        brand: brands,
        totalPages,
        currentPage,
        selectedCategory: category || null,
        selectedBrand: brand || null
      });
  
    } catch (error) {
      console.log(error);
      res.redirect("/pageNotFound"); // On error, redirect to a fallback page
    }
  };
  
  const filterPrice = async (req, res) => {
    try {
      const user = req.session.user;
      const userData = await User.findById(user);
      const brand = await Brand.find({}).lean();
      const categories = await Category.find({ isListed: true }).lean();
  
      const sort = req.query.sort || "Low-to-High";
      const itemsPerPage = 6;
      const currentPage = parseInt(req.query.page) || 1;
      const skip = (currentPage - 1) * itemsPerPage;
  
      // Sorting logic
      let sortOption={};
      switch (sort) {
        case "Low-to-High":
          sortOption.salePrice = 1;
          break;
        case "High-to-Low":
          sortOption.salePrice = -1;
          break;
        case "name-asc":
          sortOption.productName = 1; // A-Z
          break;
        case "name-desc":
          sortOption.productName = -1; // Z-A
          break;
        default:
          sortOption.salePrice = 1;
      }
  
      // Fetch product count and products with pagination
      const query = { isBlocked: false, quantity: { $gt: 0 } };
      const totalProducts = await Product.countDocuments(query);
      const totalPages = Math.ceil(totalProducts / itemsPerPage);
  
      const products = await Product.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(itemsPerPage)
        .lean();
        req.session.filteredProducts = products;
      res.render("collection", {
        user: userData,
        products:products,
        brand,
        category:categories,
        currentPage,
        totalPages,
        sort,
      });
    } catch (err) {
      console.error("Filter error:", err);
      res.status(500).send("Server error");
    }
  };
  

  const searchProduct=async(req,res)=>{
    try {
        const user=req.session.user;
        const userData = await User.findById(user);
        let search=req.body.query;

        const brands=await Brand.find({}).lean();
        const categories=await Category.find({isListed:true});
        const categoryIds=categories.map(category=>category._id);
        let searchResult=[];
        if(req.session.filteredProducts && req.session.filteredProducts.length>0){
            searchResult = req.session.filteredProducts.filter(product =>
                product.productName.toLowerCase().includes(search.toLowerCase())
              );
              
        }else{
            searchResult=await Product.find({
                productName:{$regex:".*"+search+".*",$options:"i"},
                isBlocked:false,
                quantity:{$gt:0},
                category:{$in:categoryIds}
            })
        }
        searchResult.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        let itemsPerPage=6;
        let currentPage=parseInt(req.query.page)||1
        let startIndex=(currentPage-1)*itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages=Math.ceil(searchResult.length/itemsPerPage);
        const currentProduct=searchResult.slice(startIndex,endIndex);


        res.render("collection",{
            user:userData,
            products:currentProduct,
            category:categories,
            brand:brands,
            totalPages,
            currentPage,
            count:searchResult.length
        })
    } catch (error) {
        console.log(error);
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
    loadShoppingPage,
    filterProduct,
    filterPrice,
    searchProduct
}