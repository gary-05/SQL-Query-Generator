import express from 'express';
import { getSchema } from '../services/schemaService.js';
import auth from '../middleware/auth.js';
import { getUserPool } from '../services/userPool.js';

const router = express.Router();

router.get('/schema', auth, async (req, res) => {
  try {
    const pool = await getUserPool(req.user.userId);
    const schema = await getSchema(pool);
    res.json({ schema });
  } catch (error) {
    console.error('Error fetching schema:', error);
    if (error.message.includes('connection string') || error.message.includes('configured')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch database schema' });
  }
});

export default router;
