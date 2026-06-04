const passport=require("passport");
const GoogleStrategy=require("passport-google-oauth20").Strategy;
const User=require("../models/userSchema");
const { access } = require("fs");
const env=require("dotenv").config();
const crypto=require('crypto');
async function generateReferralCode(){
  return 'REF'+crypto.randomBytes(4).toString('hex').toUpperCase();
};

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://18-crew.xyz/auth/google/callback",
  passReqToCallback: true,
}, 
async (req, accessToken, refreshToken, profile, done) => {
  try {
    console.log("Google strategy started");
    console.log("Profile ID:", profile.id);

    let user = await User.findOne({ googleId: profile.id });

    console.log("User found:", !!user);

    if (!user) {
      const referralCode = await generateReferralCode();

      user = new User({
        name: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
        referralCode,
        wallet: 0,
      });

      console.log("Creating new user");

      if (req.session.referralCode) {
        console.log("Referral code:", req.session.referralCode);

        const referrer = await User.findOne({
          referralCode: req.session.referralCode,
        });

        if (referrer) {
          referrer.wallet += 100;
          await referrer.save();

          user.redeemed = true;
          user.redeemedUser = referrer._id;
        }
      }

      await user.save();
      console.log("User saved");
    }

    return done(null, user);

  } catch (error) {
    console.error("GOOGLE STRATEGY ERROR:", error);
    return done(error, null);
  }
}));






//  assigning the data to the database using serialize user
passport.serializeUser((user, done) => {
    
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        
        const user = await User.findById(id);
        if (!user) {
           
            return done(null, false);
        }
        
        done(null, user);
        
    } catch (err) {
        console.error('Deserialize error:', err);
        done(err, null);
    }
});
module.exports=passport;