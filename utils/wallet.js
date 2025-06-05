const WalletTransaction=require("../models/walletSchema");
const User=require("../models/userSchema");

const logWalletTransaction=async(userId,type,amount,source,reference=null)=>{
if(!userId ||!type || !amount || !source){
     console.error("Wallet Transaction Missing Field: ", { userId, type, amount, source });
    throw new Error("Missing required fields for wallet transaction");
}

const user=await User.findById(userId);
if(!user) throw new Error ("User not found");

if(type==="credit"){
    user.wallet+=amount
}else if(type==="debit"){
    if(user.wallet<amount)throw new Error("Insufficient balance");
    user.wallet-=amount;
}
await user.save();


await WalletTransaction.create({
    userId,
    type,
    amount,
    source,
    reference
})
}

module.exports={logWalletTransaction};