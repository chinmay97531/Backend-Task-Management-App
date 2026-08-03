import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./passport.js";
import boardRouter from "./routes/board.js";
import authRouter from "./routes/auth.js";
import aiRouter from "./routes/ai.js";
import { FRONTEND_URL, SESSION_SECRET } from "./config.js";

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

// Required behind Render's proxy so secure cookies / OAuth redirects work
app.set("trust proxy", 1);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "taskflow-backend" });
});

app.use(
  cors({
    origin: FRONTEND_URL || "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      httpOnly: true,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", authRouter);
app.use("/api/v1/boards", boardRouter);
app.use("/api/v1/boards/ai", aiRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
