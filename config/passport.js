const passport=require("passport");
const GoogleStrategy=require("passport-google-oauth20").Strategy;
const User=require("../models/userSchema");
const { access } = require("fs");
const env=require("dotenv").config();


passport.use(new GoogleStrategy({
   clientID:process.env.GOOGLE_CLIENT_ID,
   clientSecret:process.env.GOOGLE_CLIENT_SECRET,
   callbackURL:"/auth/google/callback",
   passReqToCallback:true,
   state:true

},
async (req, accessToken, refreshToken, profile, done) => {
    try {
        if (!profile || !profile.id || !profile.emails || !profile.emails[0]) {
            return done(null, false, { message: "Invalid profile data from Google" });
        }

        let user = await User.findOne({ googleId: profile.id });

        if (!user) {            
            user = new User({
                firstname: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                referalCode: newReferralCode,
                redeemed: false,
                redeemedUsers: []
            });
            
            const savedUser = await user.save();
            
        }

        req.session.user = user; 
        return done(null, user);
    } catch (error) {
        console.error("Google signup error:", error);
        return done(error, null);
    }
}


))



//  assigning the data to the database using serialize user
passport.serializeUser((user, done) => {
    console.log('Serializing user with ID:', user._id);
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        console.log('Deserializing user with ID:', id);
        const user = await User.findById(id);
        if (!user) {
            console.log('User not found for ID:', id);
            return done(null, false);
        }
        console.log('Deserialized user:', user);
        done(null, user);
        
    } catch (err) {
        console.error('Deserialize error:', err);
        done(err, null);
    }
});
module.exports=passport;