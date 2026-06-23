const { error, log } = require("console");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const Cart = require("../../models/cartSchema");
const Coupon = require("../../models/couponSchema");
const crypto = require("crypto");
const SearchHistory = require("../../models/searchHistorySchema");
const { logWalletTransaction } = require("../../utils/wallet");
const {
  WalletSources,
  TransactionTypes,
} = require("../../constants/walletConstants");
const WishList = require("../../models/wishlistSchema");
const Banner = require("../../models/bannerSchema");

// generate unique referal code
function generateRefferalcode() {
  return "REF" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

// ...........loadRegister form...........
const loadRegister = async (req, res, next) => {
  try {
    const referralCode = req.query.ref || null;
    req.session.referralCode = referralCode;
    res.render("registeration", { referralCode, title: "Register" });
  } catch (error) {
    next(error);
  }
};
//............home page..................
const loadhomepage = async (req, res, next) => {
  try {
    const user = req.session.user;
    let cartCount = 0;

    const userData = await User.findOne({ _id: user });
    const category = await Category.find({ isListed: true });
    const cart = await Cart.findOne({ userId: user });
    const wishlist = await WishList.findOne({ userId: user });
    const banners = await Banner.find({
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    })
      .sort({ createdAt: -1 })
      .limit(1);

    let productData = await Product.find({
      isBlocked: false,
      category: { $in: category.map((cat) => cat._id) },
    });

    productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    productData = productData.slice(0, 5);
    console.log(user);

    const wishlistCount = wishlist ? wishlist.products.length : 0;
    cartCount = cart && cart.items ? cart.items.length : 0;
    if (user) {
      res.render("homepage", {
        user: userData,
        products: productData,
        category: category,
        cartCount,
        wishlistCount,
        banner: banners[0],
        title: "Home",
      });
    } else {
      res.render("homepage", {
        products: productData,
        category: category,
        cartCount,
        wishlistCount,
        banner: banners[0],
        title: "Home",
      });
    }
  } catch (error) {
    next(error);
  }
};

// ..........making password hashing.......
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log(error.message);
  }
};
// ......generate Otp...........
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
// ........sendverification mail
async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const info = await transporter.sendMail({
      from: process.env.NODEMAILE_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

// ............insert User................
const insertUser = async (req, res, next) => {
  try {
    const { name, email, mobile, password, gender } = req.body;
    const referralCode = req.body.referralCode || req.session.referralCode;

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("registeration", {
        message: "User with email already exist",
        title: "Register",
      });
    }

    let referrer = null;
    if (referralCode && referralCode.trim()) {
      referrer = await User.findOne({ referralCode: referralCode });
      if (!referrer) {
        return res.render("registeration", {
          message: "Invalid referral code",
          title: "Register",
        });
      }
    }
    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to send verification email" });
    }
    req.session.userOtp = otp;
    req.session.userData = {
      name,
      email,
      password,
      mobile,
      gender,
      referralCode: referralCode || null,
    };

    res.render("verify-otp", { title: "verify-OTP" });
    console.log("OTP sent");
  } catch (error) {
    next(error);
  }
};
// ..............verify otp...............
const verifyOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (otp === req.session.userOtp) {
      const user = req.session.userData;
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
        referralCode: referralCode,
      });
      await saveUserData.save();

      if (user.referralCode) {
        const referrer = await User.findOne({
          referralCode: user.referralCode,
        });
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
      res
        .status(400)
        .json({ success: false, message: "Invalid OTP: please try again" });
    }
  } catch (error) {
    next(error);
  }
};

// ...............resend OTP..............
const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {

      res
        .status(200)
        .json({ success: true, message: "OTP resend successfully" });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to recent otp. please try again",
      });
    }
  } catch (error) {
    next(error);
  }
};

// ...........pagenot found...............
const pageNotFound = async (req, res, next) => {
  try {
    res.render("page-404", { title: "error" });
  } catch (error) {
    next(error);
  }
};

const loadLogin = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.render("signin", {
        title: "Signin",
      });
    } else {

      res.redirect("/");
    }
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      return res.render("signin", {
        message: "User not found",
        title: "Signin",
      });
    }

    if (findUser.isBlocked) {
      return res.render("signin", {
        message: "User is blocked by admin",
        title: "Signin",
      });
    }

    // Check if user registered via Google Auth
    if (!findUser.password) {
      return res.render("signin", {
        message: "Please login using Google",
        title: "Signin",
      });
    }

    // Password validation
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("signin", {
        message: "Incorrect credentials",
        title: "Signin",
      });
    }

    // Session and redirect
   req.session.user = findUser._id;

const redirectUrl = req.session.returnTo || "/";

delete req.session.returnTo;

req.session.save((err) => {
  if (err) {
    console.error("Session save error:", err);
    return res.render("signin", {
      message: "Session error. Please try again.",
      title: "Signin",
    });
  }

  res.redirect(redirectUrl);
});
  } catch (error) {
    next(error);
  }
};

// ..........logout.................
const logout = async (req, res, next) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("session destruction error", err.message);
        return res.redirect("/pageNotFound");
      } else {
        return res.redirect("/signin");
      }
    });
  } catch (error) {
    next(error);
  }
};

const loadShoppingPage = async (req, res, next) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true });
    const cart = await Cart.findOne({ userId: user });
    const wishlist = await WishList.findOne({ userId: user });
    let cartCount = cart && cart.items ? cart.items.length : 0;
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    const categoryIds = categories.map((category) => category._id.toString());
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

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

    const brands = await Brand.find({ isBlocked: false });

    res.render("collection", {
      user: userData || null,
      products,
      category: categories,
      brand: brands,
      totalProducts,
      currentPage: page,
      totalPages,
      cartCount,
      wishlistCount,
      page: "shop",
      selectedCategories: [], // Add this
      selectedBrands: [], // Add this
      selectedSort: "",
      activeCategory: "",
      activeBrand: "",
      title: "Collection",
    });
  } catch (error) {
    next(error);
  }
};
const filterProduct = async (req, res, next) => {
  try {
    const user = req.session.user;
    const categoryIds = req.query.category ? req.query.category.split(",") : [];
    const brandIds = req.query.brand ? req.query.brand.split(",") : [];
    const sort = req.query.sort || "";
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 9;

    const cart = await Cart.findOne({ userId: user });
    let cartCount = cart?.items?.length || 0;
    const wishlist = await WishList.findOne({ userId: user });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    let query = { isBlocked: false };

    // Category filter
    if (categoryIds.length > 0) {
      query.category = { $in: categoryIds };
    }

    // Brand filter
    if (brandIds.length > 0) {
      const brands = await Brand.find({ _id: { $in: brandIds } });
      query.brand = { $in: brands.map((b) => b.brandName) };
    }

    // Default sorting (newest first)
    let sortOption = { createdAt: -1 };

    // If sort parameter is provided, override the default
    if (sort) {
      const sortOptions = {
        "Low-to-High": { salePrice: 1 },
        "High-to-Low": { salePrice: -1 },
        "name-asc": { productName: 1 },
        "name-desc": { productName: -1 },
      };
      sortOption = sortOptions[sort] || sortOption;
    }

    const [products, totalProducts, categories, brands] = await Promise.all([
      Product.find(query)
        .sort(sortOption)
        .skip((currentPage - 1) * itemsPerPage)
        .limit(itemsPerPage)
        .lean(),
      Product.countDocuments(query),
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }),
    ]);

    const totalPages = Math.ceil(totalProducts / itemsPerPage);

    res.render("collection", {
      user: user ? await User.findById(user) : null,
      products,
      category: categories,
      brand: brands,
      currentPage,
      totalPages,
      selectedCategories: categoryIds,
      selectedBrands: brandIds,
      selectedSort: sort,
      cartCount,
      wishlistCount,
      page: "shop",
      title: "Collection",
    });
  } catch (error) {
    next(error);
  }
};

const filterPrice = async (req, res, next) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const sort = req.query.sort || "";
    const cart = await Cart.findOne({ userId: user });
    let cartCount = cart?.items?.length || 0;
    const wishlist = await WishList.findOne({ userId: user });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    const categoryIds = req.query.category ? req.query.category.split(",") : [];
    const brandIds = req.query.brand ? req.query.brand.split(",") : [];

    let query = { isBlocked: false };

    if (categoryIds.length > 0) {
      query.category = { $in: categoryIds };
    } else {
      const categories = await Category.find({ isListed: true });
      query.category = { $in: categories.map((c) => c._id.toString()) };
    }

    if (brandIds.length > 0) {
      const brands = await Brand.find({ _id: { $in: brandIds } });
      query.brand = { $in: brands.map((b) => b.brandName) };
    }

    const categories = await Category.find({ isListed: true });
    query.category = { $in: categories.map((c) => c._id) };

    const sortOptions = {
      "Low-to-High": { salePrice: 1 },
      "High-to-Low": { salePrice: -1 },
      "name-asc": { productName: 1 },
      "name-desc": { productName: -1 },
      default: { createdAt: -1 },
    };
    const sortOption = sortOptions[sort] || sortOptions["default"];

    const [products, totalProducts, brands] = await Promise.all([
      Product.find(query)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
      Brand.find({ isBlocked: false }),
    ]);

    const totalPages = Math.ceil(totalProducts / limit) || 1;

    res.render("collection", {
      user: user ? await User.findById(user) : null,
      products,
      category: categories.map((c) => ({ _id: c._id, name: c.name })),
      brand: brands,
      totalProducts,
      currentPage: page,
      totalPages,
      cartCount,
      wishlistCount,
      page: "shop",
      selectedSort: sort,
      selectedCategories: categoryIds,
      selectedBrands: brandIds,
      title: "Collection",
    });
  } catch (error) {
    next(error);
  }
};

const searchProduct = async (req, res, next) => {
  try {
    const user = req.session.user;
    const search =
      req.method === "POST" ? req.body.query?.trim() : req.query.query?.trim();

    if (!search) return res.redirect("/shop");

    const cart = await Cart.findOne({ userId: user });
    let cartCount = cart?.items?.length || 0;
    const wishlist = await WishList.findOne({ userId: user });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    // Get categories and brands in parallel
    const [categories, brands] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false }).lean(),
    ]);

    // Initialize selectedCategories from query params or empty array
    const selectedCategories = req.query.category
      ? req.query.category.split(",")
      : [];

    // Search products
    let searchResult =
      req.session.filteredProducts?.length > 0
        ? req.session.filteredProducts.filter((p) =>
          p.productName.toLowerCase().includes(search.toLowerCase())
        )
        : await Product.find({
          $or: [
            { productName: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { "brand.brandName": { $regex: search, $options: "i" } },
          ],
          isBlocked: false,
          category:
            selectedCategories.length > 0
              ? { $in: selectedCategories }
              : { $in: categories.map((c) => c._id) },
        })
          .populate("brand", "brandName")
          .lean();

    // Sort by relevance
    searchResult.sort((a, b) => {
      const aNameMatch = a.productName
        .toLowerCase()
        .includes(search.toLowerCase());
      const bNameMatch = b.productName
        .toLowerCase()
        .includes(search.toLowerCase());

      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;

      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Pagination
    const itemsPerPage = 9;
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
      query: search,
      selectedCategories, // Pass to view
      selectedBrands: req.query.brand ? req.query.brand.split(",") : [], // Also initialize brands
      selectedSort: req.query.sort || "", // And sort
      wishlistCount,
      page: "shop",
      title: "Collection",
    });
  } catch (error) {
    next(error);
  }
};
const getSearchSuggestions = async (req, res) => {
  try {
    const query = req.query.query?.trim(); // we retrive the value we type
    if (!query || query.length < 2) {
      // if its length and query not ther or length <2 no suggestion is shown
      return res.json([]);
    }

    const suggestions = await Product.aggregate([
      //if query stasify condidtion
      {
        $match: {
          // find outing the name or descriotion match any product
          $or: [
            { productName: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
          ],
          isBlocked: false, // that product should not ve  blocked
        },
      },
      {
        $project: {
          _id: 0,
          name: "$productName", // only show the product name
          score: {
            $cond: [
              {
                $regexMatch: {
                  input: "$productName",
                  regex: query,
                  options: "i",
                },
              },
              2, // Higher score for name matches
              1, // Lower score for description matches
            ],
          },
        },
      },
      {
        $sort: { score: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    res.json(suggestions.map((s) => s.name));
  } catch (error) {
    console.error("Error getting search suggestions:", error);
    res.json([]);
  }
};

const referralPage = async (req, res, next) => {
  try {
    res.render("referral", { title: "Referal" });
  } catch (error) {
    next(error);
  }
};

const postReferral = async (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/register");
  }

  const { referralCode } = req.body;
  console.log(referralCode);

  try {
    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.redirect("/register");
    }

    if (user.redeemed) {
      // prevent double redeem
      return res.redirect("/");
    }

    if (referralCode) {
      // Validate referral code
      const referrer = await User.findOne({ referralCode });
      console.log(referrer);

      if (referrer && referrer._id.toString() !== user._id.toString()) {
        // Credit 100 to referrer
        await logWalletTransaction(
          referrer._id,
          "credit",
          100,
          "Referral Bonus",
          user._id
        );

        // Credit 50 to new user
        await logWalletTransaction(
          user._id,
          "credit",
          50,
          "Referral Reward",
          referrer._id
        );

        // Mark new user as redeemed
        user.redeemed = true;
        user.redeemedUser = referrer._id;
        await user.save();
      }
    }

    res.redirect("/");
  } catch (error) {
    console.error("Error processing referral:", error);
    next(error);
  }
};

const skipReferral = async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/register");
  }
  // Redirect to homepage without processing referral
  res.redirect("/");
};

const loadAboutPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const wishlist = await WishList.findOne({ userId });
    const cart = await Cart.findOne({ userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    let cartCount = 0;

    cartCount = cart && cart.items ? cart.items.length : 0;
    res.render("aboutUs", {
      page: "about",
      wishlistCount,
      cartCount,
      user,
      title: "About",
    });
  } catch (error) {
    next(error);
  }
};

const loadContactpage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const wishlist = await WishList.findOne({ userId });
    const cart = await Cart.findOne({ userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    let cartCount = 0;
    cartCount = cart && cart.items ? cart.items.length : 0;
    res.render("contact", {
      page: "contact",
      wishlistCount,
      cartCount,
      user,
      title: "Contact",
    });
  } catch (error) {
    next(error);
  }
};

const recieveMessage = async (req, res) => {
  // if a user send message though contact us page
  const { name, email, subject, message } = req.body;

  // Configure Nodemailer transporter
  const transporter = nodemailer.createTransport({
    // creating nodemailer Transport
    service: "gmail",
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
  });

  // Email options
  const mailOptions = {
    //mail forMT
    from: email,
    to: process.env.NODEMAILER_EMAIL,
    subject: subject || "New Contact Form Submission",
    html: `
      <h3>New Message from ${name}</h3>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject || "No Subject"}</p>
      <p><strong>Message:</strong> ${message}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to send message." });
  }
};

const checkUserBlock = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ isBlocked: false });
    }

    const user = await User.findById(req.session.user);
    if (!user || user.isBlocked) {
      req.session.destroy();
      return res.json({ isBlocked: true });
    }

    res.json({ isBlocked: false });
  } catch (error) {
    console.error("Error in block check route:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const loadFaqpage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const wishlist = await WishList.findOne({ userId });
    const cart = await Cart.findOne({ userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    let cartCount = 0;
    cartCount = cart && cart.items ? cart.items.length : 0;
    res.render("FAQ", {
      wishlistCount,
      cartCount,
      user,
      title: "FAQ",
    });
  } catch (error) {
    next(error);
  }
};

const loadReturnPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const wishlist = await WishList.findOne({ userId });
    const cart = await Cart.findOne({ userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    let cartCount = 0;
    cartCount = cart && cart.items ? cart.items.length : 0;
    res.render("returns", {
      wishlistCount,
      cartCount,
      user,
      title: "Return",
    });
  } catch (error) {
    next(error);
  }
};
const loadShippingPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const wishlist = await WishList.findOne({ userId });
    const cart = await Cart.findOne({ userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    let cartCount = 0;
    cartCount = cart && cart.items ? cart.items.length : 0;
    res.render("shipping", {
      wishlistCount,
      cartCount,
      user,
      title: "Shipping",
    });
  } catch (error) {
    next(error);
  }
};

const loadPrivacyPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const wishlist = await WishList.findOne({ userId });
    const cart = await Cart.findOne({ userId });
    const wishlistCount = wishlist ? wishlist.products.length : 0;
    let cartCount = 0;
    cartCount = cart && cart.items ? cart.items.length : 0;
    res.render("privacyPolicy", {
      wishlistCount,
      cartCount,
      user,
      title: "PrivacyPolicy",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
  searchProduct,
  getSearchSuggestions,
  referralPage,
  postReferral,
  skipReferral,
  loadAboutPage,
  loadContactpage,
  recieveMessage,
  checkUserBlock,
  loadFaqpage,
  loadReturnPage,
  loadShippingPage,
  loadPrivacyPage,
};
