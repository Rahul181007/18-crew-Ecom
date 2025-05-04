const Product = require("../models/productSchema");
const Category=require("../models/categorySchema");
const Brand=require("../models/brandSchema");
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
    console.log(req.files)
        
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
  
      
        const newProduct = new Product({
          productName: products.productName,
          description: products.description,
          brand: products.brand,
          category: categoryId._id,
          regularPrice: products.regularPrice,
          salePrice: products.salePrice,
          createdAt: new Date(),
          quantity: products.quantity,
          color: products.color,
          productImage: images,
          status: "Available",
          size: products.size
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
  

const getAllProduct=async(req,res)=>{
  try {
    const search=req.query.search ||"";
    const page=req.query.page ||1;
    const limit=5

    const productData =await Product.find({
        $or:[
            {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            {brand:{$regex:new RegExp(".*"+search+".*","i")}}
        ]
    }).limit(limit*1).skip((page-1)*limit).populate('category').exec()      //// Limit the number of results returned to 'limit' value (converted to number if it's a string)
                                                                            /// / Skip documents for pagination (skip (page-1)*limit products
                                                                            // Replace the 'category' ObjectId in each product with the actual category document from Category collection
                                                                            // Execute the query and wait for the result

  const count=await Product.find({
    $or:[
        {productName:{$regex:new RegExp(".*"+search+".*","i")}},
        {brand:{$regex:new RegExp(".*"+search+".*","i") }}
    ]
  }).countDocuments();
  const category=await Category.find({isListed:true});
  const brand=await Brand.find({isBlocked:false});
  if(category && brand){
    res.render("products",{
        data:productData,
        currentPage:page,
        totalPages:Math.ceil(count/limit),
        cat:category,
        brand:brand,
        activePage:"products"
    })
  }else{
    res.redirect("/admin/pageError");
  }

  } catch (error) {
    console.log(error);
    res.redirect("/admin/pageError")
  }
}
// adding product oofer
const addProductOffer=async(req,res)=>{
   try {
    const percentage=parseInt(req.body.percentage);
    const productId=req.body.productId;
    const findProduct=await Product.findOne({_id:productId})
    const findCategory=await Category.findOne({_id:findProduct.category});
    if(findCategory.categoryOffer>percentage){
      return res.json({status:false,message:"This product category already "})
    }
 findProduct.salePrice=findProduct.salePrice-Math.floor(findProduct.regularPrice*(percentage/100));
 findProduct.productOffer=parseInt(percentage);
 await findProduct.save();
 findCategory.categoryOffer=0;
 await findCategory.save();
 res.json({status:true});
   } catch (error) {
    res.redirect("/admin/pageError")
    res.status(500).json({status:false,message:"Internal server error"})
   }
}
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
  const findProduct=await Product.findOne({_id:id});
  const category=await Category.find({});
  const brand=await Brand.find({});
  res.render("edit-product",{product:findProduct,activePage:"products",brand:brand,cat:category})
} catch (error) {
  console.log(error)
  res.redirect("/admin/pageError")
}
}

// edit product
const editProduct=async(req,res)=>{
  try {
    const id= req.params.id;
    const product=await Product.findOne({_id:id});
    const data=req.body;
    const existingProduct=await Product.findOne({productName:data.productName,_id:{$ne:id}})//checking the product with same name but not same id 
    if(existingProduct){
      return res.status(400).json({error:"Product with this name already exist. Please try with name "})
    }
    const images=[];
    if(req.files && req.files.length>0){
      for(let i=0;i<req.files.length;i++){
        images.push(req.files[i].filename);
      }
    }
    const updatedFields={
      productName:data.productName,
      description:data.description,
      brand:data.brand,
      category:product.category,
      regularPrice:data.regularPrice,
      salePrice:data.salePrice,
      color:data.color,
      size:data.size,
      quantity:data.quantity
    }
    if(req.files.length>0){
     updatedFields.$push={productImage:{$each:images}}
    }
    await Product.findByIdAndUpdate(id,updatedFields,{new:true})
    res.redirect("/admin/products")
  } catch (error) {
    console.log(error)
    res.redirect("/admin/pageError")
  }
}

// // delete image(product)

// const deleteSingleImage=async(req,res)=>{
//   try {
//     const {imageId,productId}=req.body;
//     const product=await Product.findByIdAndUpdate(productId,{$pull:{productImage:imageId}});
//     const imagePath=path.join("public","uploads","re-image",imageId);
//     if(fs.existsSync(imagePath)){
//       await fs.unlinkSync(imagePath);
//       console.log(`image ${imageId} deleted successfully`)
//     }else{
//       console.log(`image ${imageId} not found`);
//     }
//     res.send({status:true})
//   } catch (error) {
//     console.log(error);
//     res.redirect("/admin/pageError")
//   }
// }


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