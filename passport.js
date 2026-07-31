import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { UserModel } from "./db.js";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
} from "./config.js";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn(
    "Google OAuth is not fully configured. Set GOOGLE_CLIENT_ID/Client_ID and GOOGLE_CLIENT_SECRET/Client_Secret in .env"
  );
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const googleId = profile.id;
          const username =
            profile.displayName ||
            profile.name?.givenName ||
            (email ? email.split("@")[0] : "Google User");

          if (!email) {
            return done(new Error("Google account did not provide an email"));
          }

          let user = await UserModel.findOne({ googleId });

          if (!user) {
            user = await UserModel.findOne({ email });
            if (user) {
              user.googleId = googleId;
              if (!user.username) user.username = username;
              await user.save();
            } else {
              user = await UserModel.create({
                username,
                email,
                googleId,
              });
            }
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
