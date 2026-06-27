import express from 'express';
import { getSchema } from '../services/schemaService.js';
import { generateQuery } from '../services/aiService.js';

const router = express.Router();

router.post('/query', async (req, res) => {
  const { userPrompt } = req.body;
  
  if (!userPrompt) {
    return res.status(400).json({ error: 'userPrompt is required in the request body' });
  }
  
  try {
    const schema = await getSchema();
    const result = await generateQuery(userPrompt, schema);
    res.json(result);
  } catch (error) {
    console.error('Error generating query:', error);
    res.status(500).json({ error: 'Failed to generate query: ' + error.message });
  }
});

export default router;
