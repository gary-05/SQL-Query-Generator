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
          explanation: "Retrieves the names and salaries of employees earning more than $50,000, ordered from highest to lowest salary.",
          tables_used: ["employees"],
          estimated_impact: "Returns approximately 5 rows",
          risk_level: "low"
        }
      ],
      ambiguity_note: "Assuming you wanted high-earning employees sorted by salary. Feel free to refine."
    };
  }

  const systemMessage = `You are an expert SQL assistant for PostgreSQL. Here is the database schema:
${schema}
For every user request, respond ONLY with a valid JSON object in this exact format:
{
  "queries": [
    {
      "sql": "SELECT ...",
      "explanation": "Plain English explanation",
      "tables_used": ["table1"],
      "estimated_impact": "Returns approximately N rows",
      "risk_level": "low"
    }
  ],
  "ambiguity_note": ""
}
Rules:
- Use exact table and column names from the schema
- Never guess column names not in the schema
- Generate 1 query if intent is clear, 2-3 if ambiguous
- Set risk_level to high for UPDATE and DELETE
- Return ONLY the JSON object, no other text`;

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
