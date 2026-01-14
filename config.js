export const MONGODBURL = process.env.MONGODBURL;
export const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODBURL) {
  throw new Error("MONGODBURL is not set. Please define it in your .env or hosting environment.");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Please define it in your .env or hosting environment.");
}
>>>>>>> fc15b4c (HostingTaskManagement)
