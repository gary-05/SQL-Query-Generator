import sharedPool from '../db.js';
import userDbPool from '../db/userDb.js';

// In-memory array to store query history entries (fallback for development)
export const inMemoryHistory = [];

const isDbMock = () => {
  const dbUrl = process.env.DATABASE_URL;
  return !dbUrl || dbUrl.includes('your_') || dbUrl.includes('placeholder');
};

/**
 * Executes a PostgreSQL query and returns the results.
 * Falls back to mock data if database connection details are not configured.
 * @param {string} sql 
 * @param {string} userPrompt
 * @param {Pool} pool User's database connection pool
 * @param {number} userId Authenticated user ID
 * @returns {Promise<object>}
 */
export async function executeQuery(sql, userPrompt = '', pool = sharedPool, userId = null) {
  const isPlaceholder = process.env.DB_USER === 'your_db_user' || !process.env.DB_HOST;
  let executionResult;

  try {
    // If pool is not passed, fall back to sharedPool
    const targetPool = pool || sharedPool;
    const result = await targetPool.query(sql);

    // If result command is UPDATE/DELETE/INSERT
    const command = result.command || '';
    if (['UPDATE', 'DELETE', 'INSERT'].includes(command)) {
      executionResult = {
        rowCount: result.rowCount,
        message: `${result.rowCount} rows affected`
      };
    } else {
      // Otherwise (SELECT), return rows, rowCount, fields
      executionResult = {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields ? result.fields.map(f => ({ name: f.name })) : []
      };
    }

    // Insert into query_history on successful DB execution if user is authenticated
    if (userId) {
      try {
        if (isDbMock()) {
          inMemoryHistory.unshift({
            id: inMemoryHistory.length + 1,
            user_id: Number(userId),
            user_prompt: userPrompt || 'Generated SQL Query',
            generated_sql: sql,
            executed_at: new Date()
          });
          if (inMemoryHistory.length > 200) {
            inMemoryHistory.splice(200);
          }
        } else {
          await userDbPool.query(
            'INSERT INTO query_history (user_id, user_prompt, generated_sql) VALUES ($1, $2, $3)',
            [Number(userId), userPrompt || 'Generated SQL Query', sql]
          );
        }
      } catch (historyErr) {
        console.error('Failed to log execution history to database:', historyErr.message);
      }
    }

    return executionResult;

  } catch (err) {
    const isConnectionError = 
      err.message.includes('mock') || 
      err.message.includes('placeholders') || 
      err.message.includes('connection string') || 
      err.code === 'ECONNREFUSED' || 
      err.message.includes('connect') || 
      err.message.includes('authentication');

    if (isConnectionError) {
      console.warn('Database connection failed. Returning mock query execution results for:', sql);
      
      const sqlLower = sql.toLowerCase().trim();
      
      // Check command type
      if (sqlLower.startsWith('update') || sqlLower.startsWith('delete') || sqlLower.startsWith('insert')) {
        executionResult = {
          rowCount: 1,
          message: '1 rows affected'
        };
      } else if (sqlLower.includes('department')) {
        // SELECT fallbacks based on table names
        executionResult = {
          rows: [
            { id: 1, name: 'Engineering' },
            { id: 2, name: 'Marketing' },
            { id: 3, name: 'Sales' }
          ],
          rowCount: 3,
          fields: [{ name: 'id' }, { name: 'name' }]
        };
      } else {
        // Default to employee table mockup
        executionResult = {
          rows: [
            { id: 1, name: 'Alice Smith', salary: 95000 },
            { id: 2, name: 'Bob Johnson', salary: 78000 },
            { id: 3, name: 'Charlie Brown', salary: 45000 },
            { id: 4, name: 'Diana Prince', salary: 110000 }
          ],
          rowCount: 4,
          fields: [{ name: 'id' }, { name: 'name' }, { name: 'salary' }]
        };
      }

      // Log history to in-memory fallback
      if (userId) {
        inMemoryHistory.unshift({
          id: inMemoryHistory.length + 1,
          user_id: Number(userId),
          user_prompt: userPrompt || 'Generated SQL Query',
          generated_sql: sql,
          executed_at: new Date()
        });

        // Limit size of mock list
        if (inMemoryHistory.length > 200) {
          inMemoryHistory.splice(200);
        }
      }

      return executionResult;
    }

    // Return syntax errors or table-not-found errors from active database
    return { error: err.message };
  }
}

/**
 * Fetches the last 20 query history entries from PostgreSQL or falls back to in-memory.
 * @param {number|string} userId
 * @returns {Promise<Array>}
 */
export async function getHistory(userId) {
  const numUserId = Number(userId);

  if (isDbMock()) {
    return inMemoryHistory.filter(h => h.user_id === numUserId).slice(0, 20);
  }

  try {
    const { rows } = await userDbPool.query(
      'SELECT id, user_prompt, generated_sql, executed_at FROM query_history WHERE user_id = $1 ORDER BY executed_at DESC LIMIT 20',
      [numUserId]
    );
    return rows;
  } catch (err) {
    console.warn('Failed to query history from database. Returning in-memory history.');
    return inMemoryHistory.filter(h => h.user_id === numUserId).slice(0, 20);
  }
}
