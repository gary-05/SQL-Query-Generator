import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generates SQL query using Groq API based on schema and userPrompt.
 * @param {string} userPrompt 
 * @param {string} schema 
 * @returns {Promise<object>}
 */
export async function generateQuery(userPrompt, schema) {
  const apiKey = process.env.GROQ_API_KEY;
  
  // If GROQ_API_KEY is not defined or is placeholder, return mock schema results for dev
  if (!apiKey || apiKey === 'your_groq_api_key') {
    console.warn('GROQ_API_KEY is not configured or is a placeholder. Returning mock SQL query for development.');
    return {
      queries: [
        {
          sql: "SELECT name, salary FROM employees WHERE salary > 50000 ORDER BY salary DESC;",
          explanation: {
            summary: "Retrieves the names and salaries of employees earning more than $50,000, ordered from highest to lowest salary.",
            clauses: [
              { clause: "SELECT", description: "Selects employee name and salary attributes." },
              { clause: "WHERE", description: "Filters for employees with a salary greater than 50,000." },
              { clause: "ORDER BY", description: "Orders the results descending by salary." }
            ],
            joins: "None",
            filters: "salary > 50000",
            aggregations: "None",
            tables_and_attributes: [
              { table: "employees", attributes: ["name", "salary"] }
            ],
            efficiency: "Optimal. Index on salary column is recommended for large datasets."
          },
          impact: {
            estimated_rows: "Returns approximately 5 rows",
            affected_rows: "N/A",
            warnings: "None"
          },
          risk_level: "low"
        }
      ],
      ambiguity_note: "Assuming you wanted high-earning employees sorted by salary. Feel free to refine."
    };
  }

  const systemMessage = `You are an expert SQL assistant for PostgreSQL databases. 

Here is the database schema you must use:
${schema}

For every user request, respond ONLY with a valid JSON object in this exact format:
{
  "queries": [
    {
      "sql": "SELECT ...",
      "explanation": {
        "summary": "Plain English summary of what this query does",
        "clauses": [
          { "clause": "SELECT", "description": "What is being selected and why" },
          { "clause": "WHERE", "description": "What filter is being applied" },
          { "clause": "JOIN", "description": "Which tables are joined and on what condition" },
          { "clause": "GROUP BY", "description": "How results are grouped" },
          { "clause": "ORDER BY", "description": "How results are sorted" }
        ],
        "joins": "Describe any joins used and which tables/keys are involved. Say 'None' if no joins.",
        "filters": "Describe any WHERE conditions or HAVING clauses. Say 'None' if no filters.",
        "aggregations": "Describe any COUNT, SUM, AVG, MAX, MIN used. Say 'None' if no aggregations.",
        "tables_and_attributes": [
          { "table": "table_name", "attributes": ["col1", "col2"] }
        ],
        "efficiency": "Rate as Optimal / Acceptable / Inefficient and explain why. Mention missing indexes, full table scans, or N+1 risks if relevant."
      },
      "impact": {
        "estimated_rows": "Approximate number of rows returned or affected",
        "affected_rows": "For SELECT: N/A. For UPDATE/DELETE/INSERT: estimated number of rows changed",
        "warnings": "Any warnings — e.g. UPDATE without WHERE affects all rows, DELETE is irreversible, no LIMIT on large table, missing index on filter column. Say 'None' if no warnings."
      },
      "risk_level": "low | medium | high"
    }
  ],
  "ambiguity_note": "If request was ambiguous, explain here. Otherwise empty string."
}

Rules:
- Only include clauses array entries for clauses actually used in the query
- Use exact table and column names from the schema
- Never guess column names not in the schema  
- Generate 1 query if intent is clear, 2-3 if ambiguous
- Set risk_level to high for UPDATE and DELETE
- Set risk_level to medium for INSERT or queries without LIMIT on large tables
- Always warn if UPDATE or DELETE has no WHERE clause
- Return ONLY the JSON object, no other text, no markdown backticks`;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const rawContent = response.data.choices[0].message.content;
    
    // Parse JSON safely even if model returns code fences
    let cleaned = rawContent.trim();
    const markdownMatch = cleaned.match(/^```(?:json)?([\s\S]*?)```$/);
    if (markdownMatch) {
      cleaned = markdownMatch[1].trim();
    }
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Groq AI API Call Error:', error.message);
    throw new Error('Failed to generate query using AI: ' + (error.response?.data?.error?.message || error.message));
  }
}
