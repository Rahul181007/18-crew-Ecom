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
  callbackURL: "https://18-crew.shop/auth/google/callback",
  passReqToCallback: true,
},
async (req, accessToken, refreshToken, profile, done) => {
  let user = await User.findOne({ googleId: profile.id });

  if (!user) {
    const referralCode = await generateReferralCode();

    user = new User({
      name: profile.displayName,
      email: profile.emails[0].value,
      googleId: profile.id,
      referralCode: referralCode,
      wallet: 0,
    });

    if (req.session.referralCode) {
      const referrer = await User.findOne({ referralCode: req.session.referralCode });
      if (referrer) {
        user.redeemed = true;
        user.redeemedUser = referrer._id;

        // optionally credit wallet both sides
        referrer.wallet += 100;
        await referrer.save();
      }
    }

    await user.save();
  }

  return done(null, user);
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