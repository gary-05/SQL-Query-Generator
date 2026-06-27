import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import schemaRouter from './routes/schema.js';
import queryRouter from './routes/query.js';
import executeRouter from './routes/execute.js';
import historyRouter from './routes/history.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', schemaRouter);
app.use('/api', queryRouter);
app.use('/api', executeRouter);
app.use('/api', historyRouter);

// Basic test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SQL Query Generator API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
