const { error } = require("console");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

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
      return res.status(400).json({ error: "Category already exists" });
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

    // Validate inputs
    if (!categoryId || isNaN(percentage) || percentage < 0) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid category ID or percentage" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ category: categoryId });

    // Block category offer if any product has a better product-level offer
    const hasProductOffer = products.some(
      (product) => product.productOffer > percentage
    );
    if (hasProductOffer) {
      return res
        .status(409)
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
        .status(404)
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
    });
    if (existingCategory) {
      return res
        .status(400)
        .json({ error: "Category already exist,please choose another name" });
    }
    const updateCategory = await Category.findByIdAndUpdate(
      id,
      { name: categoryName, description: description },
      { new: true }
    );
    console.log(updateCategory);
    if (updateCategory) {
      res.redirect("/admin/category");
    } else {
      res.status(404).json({ error: "Category not found" });
    }
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
