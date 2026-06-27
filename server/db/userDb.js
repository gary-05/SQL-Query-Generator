import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const isPlaceholder = !connectionString || connectionString.includes('your_') || connectionString.includes('placeholder');

const pool = new Pool({
  connectionString: isPlaceholder ? undefined : connectionString,
});

/**
 * Initializes the database tables if they do not exist.
 * Gracefully logs warnings if the connection fails (e.g. during dev mock mode).
 */
export async function initUserDb() {
  if (isPlaceholder) {
    console.warn('DATABASE_URL is not configured or is a placeholder. Neon User DB is running in mock memory fallback mode.');
    return;
  }

  try {
    const client = await pool.connect();
    try {
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          db_connection_string TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create query_history table linked to users
      await client.query(`
        CREATE TABLE IF NOT EXISTS query_history (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          user_prompt TEXT,
          generated_sql TEXT,
          executed_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('Neon database tables successfully initialized.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Failed to initialize Neon database tables:', err.message);
  }
}

// Automatically trigger initialization when this module is imported
initUserDb();

export default pool;
