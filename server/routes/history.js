import express from 'express';
import { getHistory } from '../services/executionService.js';

const router = express.Router();

router.get('/history', async (req, res) => {
  try {
    const history = await getHistory();
    res.json(history);
  } catch (error) {
    console.error('Routing history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch query history' });
  }
});

export default router;
