import express from 'express';
import { getSchema } from '../services/schemaService.js';

const router = express.Router();

router.get('/schema', async (req, res) => {
  try {
    const schema = await getSchema();
    res.json({ schema });
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ error: 'Failed to fetch database schema' });
  }
});

export default router;
