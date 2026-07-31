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
    scope: ["profile", "email", "openid"],
    session: false,
    // Always show the Google account chooser so a different account can be used
    prompt: "select_account",
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/?error=google_not_configured`);
  }

  // Google sometimes redirects here with ?error=... before Passport runs
  if (req.query.error) {
    const code = String(req.query.error);
    const description = String(req.query.error_description || "");
    console.error("Google OAuth denied:", code, description);
    if (code === "access_denied") {
      return res.redirect(`${FRONTEND_URL}/?error=google_access_denied`);
    }
    return res.redirect(
      `${FRONTEND_URL}/?error=google&detail=${encodeURIComponent(code)}`
    );
  }

  return passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/?error=google`,
  })(req, res, (err) => {
    if (err) {
      console.error("Google OAuth authenticate error:", err);
      const msg = String(err.message || err);
      if (/email/i.test(msg)) {
        return res.redirect(`${FRONTEND_URL}/?error=google_no_email`);
      }
      return res.redirect(`${FRONTEND_URL}/?error=google`);
    }
    return next();
  });
}, (req, res) => {
  try {
    if (!req.user?._id) {
      console.error("Google OAuth callback: no user on request");
      return res.redirect(`${FRONTEND_URL}/?error=google`);
    }
    const token = jwt.sign({ id: req.user._id.toString() }, JWT_SECRET);
    return res.redirect(
      `${FRONTEND_URL}/home?token=${encodeURIComponent(token)}`
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return res.redirect(`${FRONTEND_URL}/?error=google`);
  }
});

export default router;
