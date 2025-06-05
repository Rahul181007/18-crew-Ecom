const express=require("express");
const app=express();
const env=require("dotenv").config()
const db=require("./config/db");
const session=require("express-session");
const path=require("path");
const nocache=require("nocache")
const passport=require("./config/passport");
const cron = require('node-cron');
const Order=require("./models/orderSchema");
const errorHandler=require("./middlewares/eroorHandler")

db();

app.use(express.json());
app.use(express.urlencoded({extended:true}))

app.use(express.static(path.join(__dirname,"public")))
app.use(nocache());
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use(passport.initialize());
app.use(passport.session())
app.use((req, res, next) => {
    res.locals.user = req.user;  
    
    next();
  });
app.set("view engine","ejs");
app.set("views");

const user_route=require("./routes/userRoutes");
const admin_route=require("./routes/adminRoutes")
app.use("/",user_route);
app.use("/admin",admin_route)
app.use(errorHandler);
app.listen(process.env.PORT,()=>{
    console.log("server is started")
});
 module.exports=app;

