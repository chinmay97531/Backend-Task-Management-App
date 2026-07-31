export const MONGODBURL = process.env.MONGODBURL;
export const JWT_SECRET = process.env.JWT_SECRET;
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
export const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret";
export const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || process.env.Client_ID;
export const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || process.env.Client_Secret;
export const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  "http://localhost:3000/auth/google/callback";

if (!MONGODBURL) {
  throw new Error(
    "MONGODBURL is not set. Please define it in your .env or hosting environment."
  );
}

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Please define it in your .env or hosting environment."
  );
}
