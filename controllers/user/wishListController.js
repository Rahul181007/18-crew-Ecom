const User=require("../../models/userSchema");
const product=require("../../models/productSchema");
const Product = require("../../models/productSchema");


const loadWishlist=async(req,res)=>{
    try {
        const userId=req.session.user;
        const user=await User.findById(userId);
        const products=await Product.find({_id:{$in:user.wishlist}}).populate("category");
        console.log(req.user)
        res.render("wishlist",{
            user,
            wishlist:products,
            cartCount : user?.cart?.length ?? req.user?.cart?.length ?? 0,
            wishlistCount : user?.wishlist?.length ?? req.user?.wishlist?.length ?? 0 
        })
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }
}

const addToWishlist=async(req,res)=>{
    try {
        const productId=req.body.productId
        const userId=req.session.user;
        const user=await User.findById(userId);
        if(user.wishlist.includes(productId)){
            return res.status(200).json({status:false,message:"Product already in wishlist"})
        }
        user.wishlist.push(productId)
        await user.save();
        return res.status(200).json({status:true,message:"Product added to wishlist"})
    } catch (error) {
        console.log(error);
        return res.status(500).json({status:false,message:"Server error"})
    }
}

const deleteProduct=async(req,res)=>{
    try {
        const productId=req.query.id;
        const userId=req.session.user;
        const user=await User.findById(userId);
        const index=user.wishlist.indexOf(productId);
        user.wishlist.splice(index,1);
        await user.save();
        res.redirect("/wishList")
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound")
    }
}

module.exports={
    loadWishlist,
    addToWishlist,
    deleteProduct
}
