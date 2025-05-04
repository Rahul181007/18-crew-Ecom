const { error } = require("console");
const Category=require("../models/categorySchema");
const Product = require("../models/productSchema");





// categoryinfo
const categoryInfo=async(req,res)=>{
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
            searchQuery: searchQuery
        });
    } catch (error) {
        console.log(error);
        res.render("pageError");
    }
}

// addCategory
const addCategory=async(req,res)=>{
    const {name,description}=req.body;
    try {
        const existingCategory=await Category.findOne({name});
        if(existingCategory){
            return res.status(400).json({error:"Category already exists"});
        }
        const newCategory=new Category({
            name,
            description,
        })
        await newCategory.save();
        return res.json({message:"Catergory added successfully"})
       
     
    } catch (error) {
        return res.status(500).json("Internal server error")
    }
}


//  addCategory Offer
const addCategoryOffer=async(req,res)=>{
    try {
        const percentage=parseInt(req.body.percentage);     // Convert the percentage value from the request body to an integer
        const categoryId=req.body.categoryId;               // Get the categoryId from the request body
       const category= await Category.findById(categoryId);
       if(!category){                                        // If no such category is found, return a 404 error response
          return res.status(404).json({status:false,message:"Category Not found"})
       }
      const products=await Product.find({category:categoryId}); // Find all products that belong to this category
      const hasProductOffer=products.some((product)=>product.productOffer>percentage);// Check if any product in this category already has a product offer greater than the new category offer
      if(hasProductOffer){    
          return res.json({status:false,message:"Product within this category has already has product offer"})  // If any product has a better individual offer, block the category offer to avoid conflict
      }
      await Category.updateOne({_id:categoryId},{$set:{categoryOffer:percentage}}); // If everything is valid, update the category with the new categoryOffer percentage
      
      for(let product of products){ // Loop through all the products in the category
        product.productOffer=0;// Reset any product-level offer
        product.salePrice=product.regularPrice;// Reset the sale price back to the regular price
        await product.save()
      }
     
     return res.json({status:true});



    } catch (error) {
        res.status(500).json({status:false,message:"internal server error"})
    }

}
//  removeCategory Offer
const removeCategoryOffer=async(req,res)=>{
 try {
    const categoryId=req.body.categoryId;
    const category=await Category.findById(categoryId);
    if(!category){
        return res.status(404).json({status:false,message:"Category Not Found"})
    }
    const percentage=category.categoryOffer;
    const products=await Product.find({category:categoryId});

    if(products.length>0){
        for(const product of products){
            product.salePrice+=Math.floor(product.regularPrice*(percentage/100));
            product.productOffer=0;
            await product.save();
        }
    }
    category.categoryOffer=0
    await category.save();
    res.json({status:true});
 } catch (error) {
    console.error("Error in removeCategoryOffer:", error);
    res.status(500).json({status:false,message:"Internal server error"})
 }
}
//list category

const getListCategory=async(req,res)=>{
try {
   const id=req.query.id;
   await Category.updateOne({_id:id},{$set:{isListed:false}});
   res.redirect("/admin/category") 
} catch (error) {
    res.redirect("/pageError");
}
}


// unlist Category
const getunListCategory=async(req,res)=>{
try {
    const id=req.query.id;
    await Category.updateOne({_id:id},{$set:{isListed:true}});
    res.redirect("/admin/category") 
} catch (error) {
    res.redirect("/pageError");
}
}


// getedit category


const geteditCategory=async(req,res)=>{
    try {
        const id= req.query.id
        const category=await Category.findOne({_id:id});
        res.render("edit-category",{category:category,activePage:"category"})
    } catch (error) {
        res.redirect("/pageError")
    }

}

// edit category

const editCategory=async(req,res)=>{
try {
    const id=req.params.id;
    console.log(req.body)
    const {categoryName,description}=req.body;
    const existingCategory=await Category.findOne({name:categoryName});
    if(existingCategory){
        return res.status(400).json({error:"Category already exist,please choose another name"})
    }
    const updateCategory=await Category.findByIdAndUpdate(id,{name:categoryName,description:description},{new:true})
    console.log(updateCategory)
    if(updateCategory){
        res.redirect("/admin/category");
    }else{
        res.status(404).json({error:"Category not found"})
    }
} catch (error) {
    res.status(500).json({error:"internal server error"})
}
}





module.exports={
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getunListCategory,
    geteditCategory,
    editCategory
}