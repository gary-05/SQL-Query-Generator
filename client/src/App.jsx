import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  const [schema, setSchema] = useState('');
  const [schemaLoading, setSchemaLoading] = useState(false);

  const [executionResults, setExecutionResults] = useState({});
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleExecute = async (sql, idx) => {
    setExecutionResults(prev => ({
      ...prev,
      [idx]: { isLoading: true, error: null, data: null }
    }));

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, userPrompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to execute query');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setExecutionResults(prev => ({
        ...prev,
        [idx]: { isLoading: false, error: null, data }
      }));
      fetchHistory();
    } catch (err) {
      setExecutionResults(prev => ({
        ...prev,
        [idx]: { isLoading: false, error: err.message || 'Execution failed', data: null }
      }));
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load the schema reference and history on component mount
  useEffect(() => {
    async function fetchSchema() {
      setSchemaLoading(true);
      try {
        const response = await fetch('/api/schema');
        if (!response.ok) {
          throw new Error('Failed to load schema');
        }
        const data = await response.json();
        setSchema(data.schema);
      } catch (err) {
        console.error('Error fetching schema:', err);
      } finally {
        setSchemaLoading(false);
      }
    }
    fetchSchema();
    fetchHistory();
  }, []);

  const truncateText = (text, maxLen) => {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setExecutionResults({});

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userPrompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate queries');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskBadgeColor = (risk) => {
    const riskLower = (risk || '').toLowerCase();
    if (riskLower === 'high') return 'badge-danger';
    if (riskLower === 'medium') return 'badge-warning';
    return 'badge-success'; // low
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-badge">PostgreSQL AI Helper</div>
        <h1>SQL Query Generator</h1>
        <p className="subtitle">
          Translate natural language into optimized SQL queries instantly.
        </p>
      </header>

      <main className="app-content">
        <div className="generator-panel">
          <form onSubmit={handleSubmit} className="prompt-form">
            <label htmlFor="userPrompt" className="label-heading">
              Describe your query in plain English
            </label>
            <textarea
              id="userPrompt"
              placeholder="e.g., Show me the name and salary of employees in departments who earn more than 50000"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              disabled={isLoading}
              rows={4}
              required
            />
            <button type="submit" disabled={isLoading || !userPrompt.trim()} className="btn-submit">
              {isLoading ? (
                <>
                  <span className="spinner"></span> Generating...
                </>
              ) : (
                'Generate SQL'
              )}
            </button>
          </form>

          {error && (
            <div className="error-card">
              <div className="error-icon">⚠️</div>
              <div className="error-details">
                <h3>Generation Failed</h3>
                <p>{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="results-container">
              {result.ambiguity_note && (
                <div className="ambiguity-banner">
                  <span className="banner-icon">ℹ️</span>
                  <p><strong>Note:</strong> {result.ambiguity_note}</p>
                </div>
              )}

              <h2 className="section-title">Generated Queries ({result.queries?.length || 0})</h2>
              
              <div className="query-cards-list">
                {result.queries && result.queries.map((q, idx) => (
                  <div key={idx} className="query-card">
                    <div className="card-header">
                      <span className="query-number">Query #{idx + 1}</span>
                      <div className="card-badges">
                        <span className={`badge ${getRiskBadgeColor(q.risk_level)}`}>
                          {q.risk_level || 'low'} Risk
                        </span>
                      </div>
                    </div>

                    <div className="sql-block-wrapper">
                      <pre className="sql-code-block">
                        <code>{q.sql}</code>
                      </pre>
                    </div>

                    <div className="card-body">
                      <h3>Explanation</h3>
                      <p>{q.explanation}</p>

                      <div className="meta-info">
                        <div className="tables-used">
                          <h4>Tables used:</h4>
                          <div className="tags-list">
                            {q.tables_used && q.tables_used.map((table, tIdx) => (
                              <span key={tIdx} className="table-tag">{table}</span>
                            ))}
                            {(!q.tables_used || q.tables_used.length === 0) && (
                              <span className="no-tags">None</span>
                            )}
                          </div>
                        </div>

                        {q.estimated_impact && (
                          <div className="impact-note">
                            <strong>Estimated Impact:</strong> {q.estimated_impact}
                          </div>
                        )}
                      </div>

                      <div className="execution-section">
                        <button
                          type="button"
                          className="btn-execute"
                          disabled={executionResults[idx]?.isLoading}
                          onClick={() => handleExecute(q.sql, idx)}
                        >
                          {executionResults[idx]?.isLoading ? (
                            <>
                              <span className="spinner-small"></span> Executing...
                            </>
                          ) : (
                            'Execute Query'
                          )}
                        </button>

                        {executionResults[idx]?.error && (
                          <div className="execution-error">
                            ⚠️ <strong>Execution Failed:</strong> {executionResults[idx].error}
                          </div>
                        )}

                        {executionResults[idx]?.data && (
                          <div className="execution-result">
                            {executionResults[idx].data.message ? (
                              <div className="execution-success-msg">
                                ✅ {executionResults[idx].data.message}
                              </div>
                            ) : (
                              <div className="execution-table-wrapper">
                                <div className="table-meta">
                                  Query returned {executionResults[idx].data.rowCount} rows
                                </div>
                                <div className="table-scroll">
                                  <table className="results-table">
                                    <thead>
                                      <tr>
                                        {executionResults[idx].data.fields && executionResults[idx].data.fields.map((f, fIdx) => (
                                          <th key={fIdx}>{f.name}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {executionResults[idx].data.rows && executionResults[idx].data.rows.map((row, rIdx) => (
                                        <tr key={rIdx}>
                                          {executionResults[idx].data.fields && executionResults[idx].data.fields.map((f, fIdx) => (
                                            <td key={fIdx}>{String(row[f.name] ?? '')}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="schema-panel">
          <div className="schema-section">
            <h2 className="sidebar-title">Database Schema Reference</h2>
            {schemaLoading ? (
              <div className="schema-loading">
                <span className="spinner"></span> Loading schema metadata...
              </div>
            ) : schema ? (
              <pre className="schema-text">{schema}</pre>
            ) : (
              <div className="schema-empty">
                No active database schema connected. (Using mock layout)
              </div>
            )}
          </div>

          <div className="history-section">
            <h2 className="sidebar-title">Query History</h2>
            {historyLoading ? (
              <div className="history-loading">
                <span className="spinner"></span> Loading history...
              </div>
            ) : history.length > 0 ? (
              <div className="history-list">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="history-item"
                    onClick={() => setUserPrompt(item.user_prompt)}
                    title="Click to reload prompt"
                  >
                    <div className="history-item-header">
                      <span className="history-time">{formatTime(item.executed_at)}</span>
                    </div>
                    <p className="history-prompt">{truncateText(item.user_prompt, 70)}</p>
                    <pre className="history-sql-snippet">
                      <code>{truncateText(item.generated_sql, 60)}</code>
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="history-empty">
                No queries executed yet.
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
