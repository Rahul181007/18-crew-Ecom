// database connection - setupdatabaseconnection
const mongoose=require("mongoose");
const env=require("dotenv").config(); // process env to acess enviromental variables


const connectDB=  async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI)
    
        console.log("DB Connected")
        //MONGODB_URI- its database port and db name and it ios mentioned in .env
    } catch (error) {
        console.log("DB Connection error",error.message)
        process.exit(1);
    }
} 
module.exports=connectDB;