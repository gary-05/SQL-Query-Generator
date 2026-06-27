import express from 'express';
import pg from 'pg';
import auth from '../middleware/auth.js';
import userDbPool from '../db/userDb.js';
import { mockUsers } from './auth.js';
import { clearUserPool } from '../services/userPool.js';

const router = express.Router();
const { Pool } = pg;

// Check if Neon database is in mock fallback mode
const isDbMock = () => {
  const dbUrl = process.env.DATABASE_URL;
  return !dbUrl || dbUrl.includes('your_') || dbUrl.includes('placeholder');
};

router.post('/connection', auth, async (req, res) => {
  const { connectionString } = req.body;
  if (!connectionString) {
    return res.status(400).json({ error: 'connectionString is required in request body' });
  }

  let testPool = null;

  try {
    // Create a temporary pool to validate the connection string
    testPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    // Test connection by running SELECT 1
    await testPool.query('SELECT 1');
  } catch (err) {
    console.error('User database connection test failed:', err.message);
    return res.status(400).json({ error: 'Invalid connection string: ' + err.message });
  } finally {
    if (testPool) {
      try {
        await testPool.end();
      } catch (endErr) {
        console.error('Error closing test database pool:', endErr.message);
      }
    }
  }

  try {
    const userId = req.user.userId;

    if (isDbMock()) {
      const user = mockUsers.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'User session not found in dev registry' });
      }
      user.db_connection_string = connectionString;
      console.log(`Mock DB connection string saved for user ${userId}`);
    } else {
      await userDbPool.query(
        'UPDATE users SET db_connection_string = $1 WHERE id = $2',
        [connectionString, userId]
      );
    }

    // Force release/destroy of any existing cached pool instance for this user
    await clearUserPool(userId);

    return res.json({ success: true, message: 'Database connected successfully' });
  } catch (err) {
    console.error('Failed to save connection string:', err.message);
    return res.status(500).json({ error: 'Failed to store user database configuration: ' + err.message });
  }
});

router.get('/connection/status', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    let hasConnectionString = false;

    if (isDbMock()) {
      const user = mockUsers.find(u => u.id === userId);
      hasConnectionString = !!(user && user.db_connection_string);
    } else {
      const result = await userDbPool.query(
        'SELECT db_connection_string FROM users WHERE id = $1',
        [userId]
      );
      hasConnectionString = !!(result.rows.length > 0 && result.rows[0].db_connection_string);
    }

    return res.json({ connected: hasConnectionString });
  } catch (err) {
    console.error('Failed to check connection status:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve database connection status.' });
  }
});

export default router;
