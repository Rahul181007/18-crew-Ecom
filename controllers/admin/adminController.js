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
const loadLogin = async (req, res) => {
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
        res.status(500).send("Internal Server Error");
    }
};
// ...........admin login............
const login=async(req,res)=>{
    try {
        const {email,password}=req.body;
        const admin=await User.findOne({email,isAdmin:true});
      if(admin){
        const passwordMatch=await bcrypt.compare(password,admin.password);
        if(passwordMatch){
            req.session.admin=admin._id;
          return res.redirect("/admin")
        }else{
            return res.redirect("/admin/login")
        }
      }

    } catch (error) {
        console.log("Login error",error);
         return res.redirect("/pageError")
    }
}

// ..........loaddashboard............
const loadDashboard=async(req,res)=>{
    if(req.session.admin){
        try {
          res.render("dashboard",{
            activePage: "dashboard"
          })
        
        } catch (error) {
            res.redirect("/pageError")
        }
    }
   
}

// ..............logout...........
const logout=async(req,res)=>{
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
    res.redirect("/pageError")
  }
}


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    logout,
    pageError
};
