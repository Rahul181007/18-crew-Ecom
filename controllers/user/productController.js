const User=require("../../models/userSchema");
const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Cart=require("../../models/cartSchema");

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        const cart = await Cart.findOne({ userId });
        let cartCount=0
        cartCount = cart && cart.items ? cart.items.length : 0;
        // Get product with populated category
        const product = await Product.findById(productId).populate("category");
        
        if (!product) {
            return res.redirect('/page-not-found');
        }

        const findCategory = product.category;
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

        // Calculate total quantity from sizes array
        const totalQuantity = product.sizes.reduce((sum, size) => sum + size.stock, 0);

        // Get available sizes (filter out sizes with 0 stock)
        const availableSizes = product.sizes.filter(size => size.stock > 0);

        // Related products (same category, excluding current product)
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: productId },
        }).limit(6);

        res.render("product-details", {
            user: userData,
            product: {
                ...product._doc,
                totalQuantity // Add calculated total quantity
            },
            totalOffer,
            category: findCategory,
            relatedProducts,
            availableSizes, // Pass available sizes separately
            cartCount,
            wishlistCount: userData?.wishlist?.length ?? req.user?.wishlist?.length ?? 0
        });

    } catch (error) {
        console.error("Error in productDetails:", error);
        res.redirect("/page-error");
    }
};
  
module.exports={
    productDetails

}