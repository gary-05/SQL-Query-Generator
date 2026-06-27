import express from 'express';
import { executeQuery } from '../services/executionService.js';

const router = express.Router();

router.post('/execute', async (req, res) => {
  const { sql, userPrompt } = req.body;

  if (!sql) {
    return res.status(400).json({ error: 'SQL query string is required' });
  }

  try {
    const result = await executeQuery(sql, userPrompt);
    res.json(result);
  } catch (error) {
    console.error('Routing execution error:', error);
    res.status(500).json({ error: 'Internal execution error' });
  }
});

export default router;
