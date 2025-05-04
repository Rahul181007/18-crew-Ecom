const User = require("../models/userSchema");

const customerInfo = async (req, res) => {
  try {
    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }

    let page = parseInt(req.query.page) || 1;
    const limit = 3;

    // Fetch filtered + paginated users
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    // Get total count for pagination
    const count = await User.countDocuments({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    });

    const totalPages = Math.ceil(count / limit);

    // Pass data to view
    res.render("customers", {
      activePage: "users",  // or "customers" depending on your sidebar naming
      data: userData,
      totalPages,
      currentPage: page,
      search,  // optional: useful for keeping search value in the input
    });

  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

// ............customer blocked............
const customerBlocked=async(req,res)=>{
    try {
     let id= req.query.id;
     await User.updateOne({_id:id},{$set:{isBlocked:true}});  
     res.redirect("/admin/users")
     
    } catch (error) {
        res.redirect("/pageError")
    }
        
}
// .................customer-unblocked............
const customerunBlocked=async(req,res)=>{
    try {
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/users");
    } catch (error) {
        res.redirect("/pageError")
    }
}



module.exports={
    customerInfo,
    customerBlocked,
    customerunBlocked
}