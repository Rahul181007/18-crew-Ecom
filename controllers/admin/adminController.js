const User=require("../../models/userSchema");
const bcrypt=require("bcrypt");
const mongoose=require("mongoose");


// ............pageerror..................
const pageError=async(req,res)=>{
    res.render("admin-error",{
      activePage:"admin-error",
    });
}



// ..........loadlogin page.................
const loadLogin = async (req, res,next) => {
    try {
        if (req.session.admin) {
            // If session exists, redirect to dashboard
            return res.redirect("/admin");
        } else {
            // Otherwise, render the login page
            res.render("admin-login", { message: null });
        }
    } catch (error) {
        console.log(error);
       next(error)
    }
};
// ...........admin login............
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = admin._id;

        req.session.save((err) => {
          if (err) {
            console.error("Admin session save error:", err);
            return res.redirect("/admin/login");
          }
          res.redirect("/admin/dashboard");
        });

      } else {
        // Password incorrect - render login with error message
        return res.render("admin-login", { message: "Invalid credentials, please try again." });
      }
    } else {
      // No admin found with that email - render login with error message
      return res.render("admin-login", { message: "Invalid credentials, please try again." });
    }

  } catch (error) {
    console.log("Login error", error);
    next(error);
  }
};



// ..........loaddashboard............
const loadDashboard=async(req,res,next)=>{
    if(req.session.admin){
        try {
          res.render("dashboard",{
            activePage: "dashboard"
          })
        
        } catch (error) {
           
            next(error)
        }
    }
   
}

// ..............logout...........
const logout=async(req,res,next)=>{
  try {
    req.session.destroy(error=>{
        if(error){
            console.log("Error during destroy",error)
            res.redirect("/pageError")
        }
        res.redirect("/admin/login")
    })
  } catch (error) {
    console.log("Unexpected error during logout",error);
    next(error)
  }
}


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    logout,
    pageError
};
