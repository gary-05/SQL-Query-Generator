import sharedPool from '../db.js';

export async function getSchema(pool = sharedPool) {
  const query = `
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `;
  
  try {
    const { rows } = await pool.query(query);
    
    let formattedString = '';
    let currentTable = null;
    
    for (const row of rows) {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        formattedString += `Table: ${currentTable}\n`;
      }
      const nullableStr = row.is_nullable === 'YES' ? 'nullable' : 'not null';
      formattedString += `  - ${row.column_name} (${row.data_type}, ${nullableStr})\n`;
    }
    
    return formattedString.trim();
  } catch (error) {
    console.warn('Database connection failed. Falling back to mock schema for development.');
    return `Table: employees
  - id (integer, not null)
  - name (varchar, not null)
  - salary (numeric, nullable)
Table: departments
  - id (integer, not null)
  - name (varchar, not null)`;
  }

}
