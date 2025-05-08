const Brand=require("../../models/brandSchema");
const Product=require("../../models/productSchema");




const getBrandPage=async(req,res)=>{
try {
    const page= parseInt(req.query.page)||1;
    const limit=4;
    const skip=(page-1)*limit;
    const brandData=await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit);
    const totalBrands=await Brand.countDocuments();
    const totalPages=Math.ceil(totalBrands/limit);
    
    res.render("brands",{
        brands:brandData,
        currentPage:page,
        totalPages:totalPages,
        totalBrands:totalBrands,
        activePage: "brands",
    })
} catch (error) {
    res.redirect("/pageError")
}
}

const addBrand = async (req, res) => {
    try {
      const brandName = req.body.name;
  
      const existBrand = await Brand.findOne({ brandName: brandName });
      if (existBrand) {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const brandData = await Brand.find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);
        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);
  
        return res.render("brands", {
          brands: brandData,
          currentPage: page,
          totalPages: totalPages,
          totalBrands: totalBrands,
          activePage: "brands",
          error: "Brand already exists!",
        });
      }
  
      const image = req.file.filename;
      const newBrand = new Brand({
        brandName: brandName,
        brandImage: image,
      });
      await newBrand.save();
      res.redirect("/admin/brands");
    } catch (error) {
      console.log(error)
      res.redirect("/admin/pageError");
    }
  };
  
// ....block brand
const blockBrand=async(req,res)=>{
    try {
        const id=req.query.id;
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/brands")
    } catch (error) {
        res.redirect("/admin/pageError")
    }
}

// ......unblock brand
const unblockBrand=async(req,res)=>{
try {
    const id=req.query.id;
    await Brand.updateOne({_id:id},{$set:{isBlocked:false}})
    res.redirect("/admin/brands")
} catch (error) {
    res.redirect("/admin/pageError")
}
}

// delete brand

const deleteBrand=async(req,res)=>{
  try {
    const id=req.query.id;
  if(!id){
    return res.status(404).redirect("/admin/pageError")
  }

    await Brand.deleteOne({_id:id});
    res.redirect("/admin/brands")
  } catch (error) {
    console.log("Error occured",error);
    res.status(500).redirect("/admin/pageError")
  }
}





module.exports={
    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand
}