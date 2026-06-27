import express from 'express';
import { getSchema } from '../services/schemaService.js';
import { generateQuery } from '../services/aiService.js';
import auth from '../middleware/auth.js';
import { getUserPool } from '../services/userPool.js';

const router = express.Router();

router.post('/query', auth, async (req, res) => {
  const { userPrompt } = req.body;
  
  if (!userPrompt) {
    return res.status(400).json({ error: 'userPrompt is required in the request body' });
  }
  
  try {
    const pool = await getUserPool(req.user.userId);
    const schema = await getSchema(pool);
    const result = await generateQuery(userPrompt, schema);
    res.json(result);
  } catch (error) {
    console.error('Error generating query:', error);
    if (error.message.includes('connection string') || error.message.includes('configured')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to generate query: ' + error.message });
  }
});

export default router;
