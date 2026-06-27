import express from 'express';
import { executeQuery } from '../services/executionService.js';
import auth from '../middleware/auth.js';
import { getUserPool } from '../services/userPool.js';

const router = express.Router();

router.post('/execute', auth, async (req, res) => {
  const { sql, userPrompt } = req.body;

  if (!sql) {
    return res.status(400).json({ error: 'SQL query string is required' });
  }

  try {
    const pool = await getUserPool(req.user.userId);
    const result = await executeQuery(sql, userPrompt, pool, req.user.userId);
    res.json(result);
  } catch (error) {
    console.error('Routing execution error:', error);
    if (error.message.includes('connection string') || error.message.includes('configured')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal execution error' });
  }
});

export default router;
