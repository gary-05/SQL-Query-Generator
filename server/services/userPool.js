import pg from 'pg';
import userDbPool from '../db/userDb.js';
import { mockUsers } from '../routes/auth.js';

const { Pool } = pg;

// Map to cache active pools per user ID: userId -> Pool
const activeUserPools = new Map();

// Check if Neon database is in mock fallback mode
const isDbMock = () => {
  const dbUrl = process.env.DATABASE_URL;
  return !dbUrl || dbUrl.includes('your_') || dbUrl.includes('placeholder');
};

/**
 * Returns a cached pg.Pool for the given user, or creates and caches one.
 * @param {number|string} userId 
 * @returns {Promise<Pool>}
 */
export async function getUserPool(userId) {
  const numUserId = Number(userId);
  
  if (activeUserPools.has(numUserId)) {
    return activeUserPools.get(numUserId);
  }

  let connectionString = null;

  if (isDbMock()) {
    const user = mockUsers.find(u => u.id === numUserId);
    connectionString = user ? user.db_connection_string : null;
  } else {
    try {
      const result = await userDbPool.query(
        'SELECT db_connection_string FROM users WHERE id = $1',
        [numUserId]
      );
      if (result.rows.length > 0) {
        connectionString = result.rows[0].db_connection_string;
      }
    } catch (err) {
      console.error(`Failed to fetch connection string for user ${numUserId}:`, err.message);
      throw new Error('Failed to retrieve user database configuration from storage.');
    }
  }

  if (!connectionString) {
    throw new Error('No database connection string configured for this user. Please configure your connection.');
  }

  // Create the database pool with SSL configured (essential for Neon and cloud databases)
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  activeUserPools.set(numUserId, pool);
  return pool;
}

/**
 * Ends and deletes the connection pool associated with the user.
 * @param {number|string} userId 
 * @returns {Promise<void>}
 */
export async function clearUserPool(userId) {
  const numUserId = Number(userId);
  if (activeUserPools.has(numUserId)) {
    const pool = activeUserPools.get(numUserId);
    try {
      await pool.end();
      console.log(`Successfully closed database pool for user: ${numUserId}`);
    } catch (err) {
      console.error(`Error closing pool for user ${numUserId}:`, err.message);
    }
    activeUserPools.delete(numUserId);
  }
}
