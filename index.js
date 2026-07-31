import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./passport.js";
import boardRouter from "./routes/board.js";
import authRouter from "./routes/auth.js";
import { FRONTEND_URL, SESSION_SECRET } from "./config.js";

const app = express();
const PORT = process.env.PORT || 3000;

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
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", authRouter);
app.use("/api/v1/boards", boardRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
