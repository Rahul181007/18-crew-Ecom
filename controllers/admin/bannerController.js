const Banner=require("../../models/bannerSchema");


const getBanners=async(req,res)=>{
    const banners=await Banner.find();
    console.log(banners)
    res.render("bannerList",{banners,
        activePage : 'banner'
    })
};

const addBannerPage = (req, res) => {
  res.render("addBanner",{
    activePage : 'banner'
  });
};
const addBanner=async(req,res)=>{
    try {
      const {title,description,link,startDate,endDate} =req.body
      const image=req.file.filename;
      
      const banner=new Banner({
        title,
        description,
        link,
        startDate,
        endDate,
        image
      });

      await banner.save();
      res.redirect("/admin/banners")
    } catch (error) {
        console.error("Add banner errors",error);
        res.redirect("/admin/banners/add")
    }
}
const deleteBanner=async(req,res)=>{
    try {
        await Banner.findByIdAndDelete(req.params.id);
        res.redirect("/admin/banners");
    } catch (error) {
         console.error("Delete Error:", err);
    res.redirect("/admin/banners");
    }
}
module.exports={
    getBanners,
    addBanner,
    addBannerPage,
    deleteBanner
}