const { error } = require("console");
const User=require("../models/userSchema");

const userAuth = (req, res, next) => {
    if (!req.session.user) {
      console.log('No user in session - redirecting to login');
      return res.redirect("/signin");
    }
    
    User.findById(req.session.user)
      .then(data => {
        if (!data) {
          console.log('User not found in DB');
          return res.redirect("/signin");
        }
        if (data.isBlocked) {
          console.log('User is blocked');
          return res.redirect("/signin");
        }
        next();
      })
      .catch(error => {
        console.error("Error in user auth middleware", error);
        res.redirect("/signin");
      });
  };




const adminAuth=(req,res,next)=>{
    if(!req.session.admin){
      console.log("No user in session - redirecting to admin login");
      return res.redirect("/admin/login")
    }
        User.findById(req.session.admin)
        .then(admin=>{
          if(admin && admin.isAdmin){
            return next()
          }else{
            console.log("User is not an admin, Redirecting admin login page");
            res.redirect("/admin/login")
          }
        })
        .catch(error => {
          console.log("Error in admin auth middleware:", error);
          res.status(500).send("Internal server error");
        });
    
    
}

module.exports={
    userAuth,
    adminAuth
}