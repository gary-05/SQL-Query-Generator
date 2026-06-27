import pool from '../db.js';

// In-memory array to store query history entries (fallback for development)
export const inMemoryHistory = [];

/**
 * Executes a PostgreSQL query and returns the results.
 * Falls back to mock data if database connection details are not configured.
 * @param {string} sql 
 * @param {string} userPrompt
 * @returns {Promise<object>}
 */
export async function executeQuery(sql, userPrompt = '') {
  const isPlaceholder = process.env.DB_USER === 'your_db_user' || !process.env.DB_HOST;
  let executionResult;

  try {
    if (isPlaceholder) {
      throw new Error('Database placeholders detected. Falling back to mock execution.');
    }

    const result = await pool.query(sql);

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

    // Insert into query_history on successful DB execution
    try {
      await pool.query(
        'INSERT INTO query_history (user_prompt, generated_sql) VALUES ($1, $2)',
        [userPrompt || 'Generated SQL Query', sql]
      );
    } catch (historyErr) {
      console.error('Failed to log execution history to database:', historyErr.message);
    }

    return executionResult;

  } catch (err) {
    const isConnectionError = 
      err.message.includes('mock') || 
      err.code === 'ECONNREFUSED' || 
      err.message.includes('connect') || 
      err.message.includes('authentication');

    if (isConnectionError) {
      console.warn('Database connection failed or placeholder detected. Returning mock query execution results for:', sql);
      
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
      inMemoryHistory.unshift({
        id: inMemoryHistory.length + 1,
        user_prompt: userPrompt || 'Generated SQL Query',
        generated_sql: sql,
        executed_at: new Date()
      });

      // Keep only last 20
      if (inMemoryHistory.length > 20) {
        inMemoryHistory.splice(20);
      }

      return executionResult;
    }

    // Return syntax errors or table-not-found errors from active database
    return { error: err.message };
  }
}

/**
 * Fetches the last 20 query history entries from PostgreSQL or falls back to in-memory.
 * @returns {Promise<Array>}
 */
export async function getHistory() {
  const isPlaceholder = process.env.DB_USER === 'your_db_user' || !process.env.DB_HOST;

  try {
    if (isPlaceholder) {
      throw new Error('Database placeholders detected. Falling back to mock history.');
    }

    const { rows } = await pool.query(
      'SELECT id, user_prompt, generated_sql, executed_at FROM query_history ORDER BY executed_at DESC LIMIT 20'
    );
    return rows;
  } catch (err) {
    console.warn('Failed to query history from database. Returning in-memory history.');
    return inMemoryHistory;
  }
}
