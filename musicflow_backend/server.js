// server.js
import express from 'express';
import dotenv from 'dotenv';
import claudeRouter from './routes/claude.route.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware để parse JSON body
app.use(express.json());

// Mount Claude API route
app.use('/api/claude', claudeRouter);

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
