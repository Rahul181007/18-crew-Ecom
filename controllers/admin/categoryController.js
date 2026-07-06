const { error } = require("console");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const STATUS_CODE=require("../../constants/httpStatus");
// categoryinfo
const categoryInfo = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search || "";

    const query = {};
    if (searchQuery) {
      query.name = { $regex: searchQuery, $options: "i" }; // case-insensitive search
    }

    const categoryData = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
      activePage: "category",
      searchQuery: searchQuery,
    });
  } catch (error) {

    next(error);
  }
};

// addCategory
const addCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const image = req.file ? req.file.filename : "default-category.png";

    const existingCategory = await Category.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });
    if (existingCategory) {
      return res.status(STATUS_CODE.CONFLICT).json({ error: "Category already exists" });
    }

    const newCategory = new Category({
      name,
      description,
      image,
    });

    await newCategory.save();
    return res.json({ message: "Category added successfully" });
  } catch (error) {
    next(error);
  }
};

//  addCategory Offer
const addCategoryOffer = async (req, res, next) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    const MIN_OFFER = 1;
    const MAX_OFFER = 90;

    if (!categoryId) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        status: false,
        message: "Category ID is required",
      });
    }

    if (isNaN(percentage)) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        status: false,
        message: "Invalid offer percentage",
      });
    }

    if (percentage < MIN_OFFER || percentage > MAX_OFFER) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({
        status: false,
        message: `Offer percentage must be between ${MIN_OFFER}% and ${MAX_OFFER}%`,
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(STATUS_CODE.NOT_FOUND)
        .json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ category: categoryId });

    // Block category offer if any product has a better product-level offer
    const hasProductOffer = products.some(
      (product) => product.productOffer > percentage
    );
    if (hasProductOffer) {
      return res
        .status(STATUS_CODE.CONFLICT)
        .json({
          status: false,
          message:
            "One or more products in this category already have a better individual offer",
        });
    }

    // Update the category offer
    await Category.updateOne(
      { _id: categoryId },
      { $set: { categoryOffer: percentage } }
    );

    return res.json({ status: true });
  } catch (error) {

    next(error);
  }
};

//  removeCategory Offer
const removeCategoryOffer = async (req, res, next) => {
  try {
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(STATUS_CODE.NOT_FOUND)
        .json({ status: false, message: "Category Not Found" });
    }
    const percentage = category.categoryOffer;
    const products = await Product.find({ category: categoryId });

    if (products.length > 0) {
      for (const product of products) {
        product.salePrice += Math.floor(
          product.regularPrice * (percentage / 100)
        );
        product.productOffer = 0;
        await product.save();
      }
    }
    category.categoryOffer = 0;
    await category.save();
    res.json({ status: true });
  } catch (error) {
    next(error);
  }
};
//list category

const getListCategory = async (req, res, next) => {
  try {
    const id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect("/admin/category");
  } catch (error) {
    // res.redirect("/pageError");
    next(error);
  }
};

// unlist Category
const getunListCategory = async (req, res, next) => {
  try {
    const id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");
  } catch (error) {
    // res.redirect("/pageError");
    next(error);
  }
};

// getedit category

const geteditCategory = async (req, res, next) => {
  try {
    const id = req.query.id;
    const category = await Category.findOne({ _id: id });
    if (!category) {
      const error = new Error("category not found");
      error.statusCode = STATUS_CODE.NOT_FOUND;
      return next(error);
    }
    res.render("edit-category", { category: category, activePage: "category" });
  } catch (error) {
    next(error);
  }
};

// edit category

const editCategory = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

    const existingCategory = await Category.findOne({
      name: { $regex: `^${categoryName}$`, $options: "i" },
      _id: { $ne: id }
    });

    if (existingCategory) {
      return res.status(STATUS_CODE.CONFLICT).json({
        error: "Category already exists, please choose another name"
      });
    }

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: categoryName,
        description
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updateCategory) {
      return res.status(STATUS_CODE.NOT_FOUND).json({
        error: "Category not found"
      });
    }

    return res.redirect("/admin/category");

  } catch (error) {
    next(error);
  }
};

module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getunListCategory,
  geteditCategory,
  editCategory,
};
