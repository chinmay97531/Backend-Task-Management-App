import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import boardRouter from './routes/board.js';
const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use('/api/v1/boards', boardRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}
);