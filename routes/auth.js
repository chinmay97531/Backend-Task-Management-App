import express from "express";
import jwt from "jsonwebtoken";
import passport from "../passport.js";
import { FRONTEND_URL, JWT_SECRET, GOOGLE_CLIENT_ID } from "../config.js";

const router = express.Router();

router.get("/google", (req, res, next) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({
      message: "Google OAuth is not configured on the server.",
    });
  }
  return passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    // Always show the Google account chooser so a different Gmail can be used
    prompt: "select_account",
  })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    if (!GOOGLE_CLIENT_ID) {
      return res.redirect(`${FRONTEND_URL}/?error=google_not_configured`);
    }
    return passport.authenticate("google", {
      session: false,
      failureRedirect: `${FRONTEND_URL}/?error=google`,
    })(req, res, next);
  },
  (req, res) => {
    try {
      if (!req.user?._id) {
        console.error("Google OAuth callback: no user on request");
        return res.redirect(`${FRONTEND_URL}/?error=google`);
      }
      const token = jwt.sign({ id: req.user._id.toString() }, JWT_SECRET);
      return res.redirect(`${FRONTEND_URL}/home?token=${encodeURIComponent(token)}`);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      return res.redirect(`${FRONTEND_URL}/?error=google`);
    }
  }
);

export default router;
