const { error } = require("console");
const User=require("../models/userSchema");

const userAuth=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }else{
                res.redirect("/signin");
            }
        })
        .catch(error=>{
            console.log("Error is in user auth middleware");
            res.status(500).send("internal server error")
        })
    }else{
        res.redirect("/signin")
    }

}


const adminAuth=(req,res,next)=>{
    
        User.findOne({isAdmin:true})
        .then(data=>{
            if(data){
                next();

            }else{
                res.redirect("/admin/login")
            }
        })
        .catch(error=>{
            console.log("Error is in admin auth middleware");
            res.status(500).send("internal server Error");
        })
    
}

module.exports={
    userAuth,
    adminAuth
}