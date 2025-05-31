const express=require("express");
const app=express();
const env=require("dotenv").config()
const db=require("./config/db");
const session=require("express-session");
const path=require("path");
const nocache=require("nocache")
const passport=require("./config/passport");
const cron = require('node-cron');
const Order=require("./models/orderSchema")

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

cron.schedule('*/5 * * * *', async () => {
  try {
    const deleted = await Order.deleteMany({
      status: 'Initiated',
      isPaid: false,
      createdAt: { $lt: new Date(Date.now() - 3 * 60 * 1000) }, 
    });
    if (deleted.deletedCount > 0) {
      console.log(`Cleaned up ${deleted.deletedCount} unpaid initiated orders`);
    }
  } catch (error) {
    console.error('Error cleaning unpaid initiated orders:', error);
  }
});





app.listen(process.env.PORT,()=>{
    console.log("server is started")
});
 module.exports=app;

