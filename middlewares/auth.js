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




const adminAuth = (req, res, next) => {
   
    const isAjax = req.xhr || req.headers.accept.includes('json');

    if (!req.session.admin) {
        console.log("No user in session - redirecting to admin login");
        if (isAjax) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: Please log in as admin'
            });
        }
        return res.redirect("/admin/login");
    }

    User.findById(req.session.admin)
        .then(admin => {
            if (admin && admin.isAdmin) {
                
                req.admin = admin; // Optional: Attach admin to request
                return next();
            } else {
                console.log("User is not an admin, Redirecting admin login page");
                if (isAjax) {
                    return res.status(403).json({
                        success: false,
                        message: 'Forbidden: Admin access required'
                    });
                }
                res.redirect("/admin/login");
            }
        })
        .catch(error => {
            console.error("Error in admin auth middleware:", error);
            if (isAjax) {
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
            res.status(500).send("Internal server error");
        });
};

module.exports={
    userAuth,
    adminAuth
}