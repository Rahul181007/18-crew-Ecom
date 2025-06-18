const Banner = require("../../models/bannerSchema");

const getBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find();
    res.render("bannerList", {
      banners,
      activePage: "banner",
    });
  } catch (error) {
    next(error);
  }
};

const addBannerPage = (req, res, next) => {
  try {
    res.render("addBanner", {
      activePage: "banner",
    });
  } catch (error) {
    next(error);
  }
};
const addBanner = async (req, res, next) => {
  try {
    const { title, description, link, startDate, endDate } = req.body;
    const image = req.file.filename;

    const banner = new Banner({
      title,
      description,
      link,
      startDate,
      endDate,
      image,
    });

    await banner.save();
    res.redirect("/admin/banners");
  } catch (error) {
    next(error);
  }
};
const deleteBanner = async (req, res, next) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.redirect("/admin/banners");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBanners,
  addBanner,
  addBannerPage,
  deleteBanner,
};
