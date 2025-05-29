const Product = require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Brand=require("../../models/brandSchema");
const fs=require("fs");
const path=require("path");
const sharp=require("sharp"); // it is used for image resizing and image setting

const getProductAddPage=async(req,res)=>{
    try {
        const category=await Category.find({isListed:true});
        const brand=await Brand.find({isBlocked:false});
        res.render("product-add",{
            cat:category,
            brand:brand,
            activePage:"addProduct",
        })
    } catch (error) {
      console.log(error);
        res.redirect("/admin/pageError")
    }
}

const addProducts = async (req, res) => {
  try {
    const products = req.body;

    const productExist = await Product.findOne({
      productName: products.productName
    });

    if (!productExist) {
      const images = [];
      console.log(req.files);

      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const originalImagePath = req.files[i].path;

          const resizedImagePath = path.join(
            "public",
            "uploads",
            "product-images",
            req.files[i].filename
          );

          await sharp(originalImagePath)
            .resize({ width: 440, height: 440 })
            .toFile(resizedImagePath);

          images.push(req.files[i].filename);
        }
      }

      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
        return res.status(400).json("Invalid category name");
      }

      
      let sizesWithStock = [];

      if (products.sizes) {
        let selectedSizes = [];

        if (Array.isArray(products.sizes)) {
          selectedSizes = products.sizes;
        } else {
          selectedSizes = [products.sizes]; // Only one size selected
        }

        sizesWithStock = selectedSizes.map(size => {
          const stockKey = `stock_${size}`;
          const stockValue = parseInt(products[stockKey]) || 0;
          return { size, stock: stockValue };
        });
      }

      // ✅ Create and save new product
      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        brand: products.brand,
        category: categoryId._id,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        createdAt: new Date(),
        color: products.color,
        productImage: images,
        status: "Available",
        sizes: sizesWithStock 
      });

      await newProduct.save();
      res.redirect("/admin/addProducts");

    } else {
      return res.status(400).json("Product already exists, try another name.");
    }
  } catch (error) {
    console.log(error);
    return res.redirect("/admin/pageError");
  }
};

  
const getAllProduct = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    // Build the base query
    const query = {
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ]
    };

    // Get products with populated category
    const productData = await Product.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('category')
      .lean()
      .exec();

    // Get total count for pagination
    const count = await Product.countDocuments(query);

    // Get categories and brands
    const [category, brand] = await Promise.all([
      Category.find({ isListed: true }),
      Brand.find({ isBlocked: false })
    ]);

    // Process product data - calculate total quantity and handle null categories
    const processedData = productData.map(product => {
      // Calculate total quantity from sizes array
      const totalQuantity = product.sizes.reduce((sum, size) => sum + (size.stock || 0), 0);
      
      return {
        ...product,
        quantity: totalQuantity, // Add calculated quantity
        category: product.category || { name: "Uncategorized" } // Default for null categories
      };
    });

    res.render("products", {
      data: processedData,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      cat: category,
      brand: brand,
      activePage: "products",
      searchQuery: search
    });

  } catch (error) {
    console.error("Error in getAllProduct:", error);
    res.redirect("/admin/pageError");
  }
};
// adding product oofer
const addProductOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const productId = req.body.productId;

    // Validate inputs
    if (!productId || isNaN(percentage) || percentage < 0) {
      return res.status(400).json({ status: false, message: 'Invalid product ID or percentage' });
    }

    const findProduct = await Product.findOne({ _id: productId });
    if (!findProduct) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    const findCategory = await Category.findOne({ _id: findProduct.category });
    if (!findCategory) {
      return res.status(404).json({ status: false, message: 'Category not found' });
    }

    if (findCategory.categoryOffer > percentage) {
      return res.status(400).json({ status: false, message: 'This product category already has a higher offer' });
    }

    // Update only specific fields
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId },
      {
        $set: {
          salePrice: findProduct.salePrice - Math.floor(findProduct.regularPrice * (percentage / 100)),
          productOffer: parseInt(percentage),
        },
      },
      { new: true, runValidators: true }
    );


    return res.json({ status: true });
  } catch (error) {
    console.error('Error in addProductOffer:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
};
// removeProductOffer
const removeProductOffer=async(req,res)=>{
  try {
    const productId=req.body.productId;
    const findProduct=await Product.findOne({_id:productId});
    const percentage=findProduct.productOffer;
    findProduct.salePrice=findProduct.salePrice+Math.floor(findProduct.regularPrice*(percentage/100));
    findProduct.productOffer=0;
     await findProduct.save();
    res.json({status:true});

  } catch (error) {
    res.redirect("/admin/pageError")
    res.status(500).json({status:false,message:"Internal server error"})
  }
}

const blockProduct=async(req,res)=>{
try {
  const productId=req.query.id;
  await Product.updateOne({_id:productId},{$set:{isBlocked:true}});
  res.redirect("/admin/products");
} catch (error) {
  res.redirect("/admin/pageError")
}
}
const unblockProduct=async(req,res)=>{
 try {
  const productId=req.query.id;
  await Product.updateOne({_id:productId},{$set:{isBlocked:false}});
  res.redirect("/admin/products");
 } catch (error) {
  res.redirect("/admin/pageError")
 }
}

// getedit product
const geteditProduct=async(req,res)=>{
try {
  const id=req.query.id;
  const findProduct=await Product.findOne({_id:id}).populate("category");
  const category=await Category.find({});
  const brand=await Brand.find({});
  console.log(findProduct)
  console.log(category)
  res.render("edit-product",{product:findProduct,activePage:"products",brand:brand,cat:category})
} catch (error) {
  console.log(error)
  res.redirect("/admin/pageError")
}
}

// edit product
const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });
    const data = req.body;
    
    // Check for existing product with same name
    const existingProduct = await Product.findOne({ 
      productName: data.productName,
      _id: { $ne: id }
    });
    
    if (existingProduct) {
      return res.status(400).json({ error: "Product with this name already exists. Please try a different name." });
    }

    // Process sizes and stock
    let sizesArray = [];
    if (Array.isArray(data.sizes)) {
      // Multiple sizes selected
      data.sizes.forEach(size => {
        sizesArray.push({
          size: size,
          stock: parseInt(data[`stock_${size}`]) || 0
        });
      });
    } else if (data.sizes) {
      // Single size selected
      sizesArray.push({
        size: data.sizes,
        stock: parseInt(data[`stock_${data.sizes}`]) || 0
      });
    }

    // Calculate total quantity
    const totalQuantity = sizesArray.reduce((sum, size) => sum + size.stock, 0);

    // Process images
    const images = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        images.push(req.files[i].filename);
      }
    }

    // Find category
    const category = await Category.findOne({ name: data.category });
    if (!category) {
      return res.status(400).json({ error: "Category not found" });
    }

    // Prepare update object
    const updatedFields = {
      productName: data.productName,
      description: data.description,
      brand: data.brand,
      category: category._id, // Store reference to category
      regularPrice: data.regularPrice,
      salePrice: data.salePrice,
      color: data.color,
      sizes: sizesArray,
      quantity: totalQuantity
    };

    // Add new images if any
    if (req.files.length > 0) {
      updatedFields.$push = { productImage: { $each: images } };
    }

    // Update product
    await Product.findByIdAndUpdate(id, updatedFields, { new: true });
    res.redirect("/admin/products");
  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageError");
  }
};




const updateProductImage = async (req, res) => {
  try {
    const { productId, imageIndex } = req.body;

    if (!req.file) {
      return res.status(400).json({ status: false, message: 'No image file uploaded.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    // replace image at specified index
    product.productImage[imageIndex] = req.file.filename;

    await product.save();

    return res.status(200).json({ status: true, message: 'Image updated successfully' });

  } catch (error) {
    console.log(error);
    res.status(500).json({ status: false, message: 'Server error' });
  }
};



module.exports={
    getProductAddPage,
    addProducts,
    getAllProduct,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
   geteditProduct,
   editProduct,
   updateProductImage
}