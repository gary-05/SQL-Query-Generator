import React, { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  // Navigation Routing State: 'login' | 'signup' | 'connect' | 'app'
  const [currentPage, setCurrentPage] = useState('login');
  
  // Auth Session State
  const [userEmail, setUserEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  // Database Connection State
  const [connectionString, setConnectionString] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(null); // { success, message, error }
  const [connectLoading, setConnectLoading] = useState(false);

  // Main App State
  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  
  // Card UI state
  const [expandedCards, setExpandedCards] = useState({}); // { [queryIndex]: boolean }
  const [copiedQueryIndex, setCopiedQueryIndex] = useState(null); // index of recently copied query
  
  // Execution Results state: { [queryIndex]: { isLoading, error, rows, rowCount, fields, message } }
  const [executionResults, setExecutionResults] = useState({});

  // 1. Session Initialization
  useEffect(() => {
    const token = localStorage.getItem('sql_token');
    const email = localStorage.getItem('sql_email');
    if (token && email) {
      setUserEmail(email);
      checkConnectionStatus(token);
    } else {
      setCurrentPage('login');
    }
  }, []);

  // 2. Fetch User Connection Status on Init
  const checkConnectionStatus = async (token) => {
    try {
      const res = await fetch('/api/connection/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.connected) {
        localStorage.setItem('db_connected', 'true');
        setCurrentPage('app');
        fetchHistory(token);
      } else {
        localStorage.setItem('db_connected', 'false');
        setCurrentPage('connect');
      }
    } catch (err) {
      console.error('Failed to retrieve connection status:', err);
      // Fallback: Check local storage status if network fails
      const localConnected = localStorage.getItem('db_connected') === 'true';
      setCurrentPage(localConnected ? 'app' : 'connect');
    }
  };

  // 3. Fetch Query History list
  const fetchHistory = async (token) => {
    const currentToken = token || localStorage.getItem('sql_token');
    if (!currentToken) return;

    try {
      const res = await fetch('/api/history', {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  // 4. Authentication Action Handlers
  const handleAuthSubmit = async (e, type) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const email = e.target.email.value;
    const password = e.target.password.value;

    if (type === 'signup') {
      const confirmPassword = e.target.confirmPassword.value;
      if (password !== confirmPassword) {
        setAuthError('Passwords do not match');
        setAuthLoading(false);
        return;
      }
    }

    try {
      const url = type === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('sql_token', data.token);
      localStorage.setItem('sql_email', data.email);
      setUserEmail(data.email);

      // Check DB connection to route user appropriately
      await checkConnectionStatus(data.token);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUserEmail('');
    setHistory([]);
    setResult(null);
    setUserPrompt('');
    setExpandedCards({});
    setExecutionResults({});
    setCurrentPage('login');
  };

  // 5. Connect Database handler
  const handleConnectDb = async (e) => {
    e.preventDefault();
    setConnectionStatus(null);
    setConnectLoading(true);

    const token = localStorage.getItem('sql_token');
    if (!token) return;

    try {
      const res = await fetch('/api/connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ connectionString })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Database connection test failed');
      }

      setConnectionStatus({ success: true, message: data.message });
      localStorage.setItem('db_connected', 'true');
      
      // Delay routing to app slightly to show success checkmark
      setTimeout(() => {
        setCurrentPage('app');
        fetchHistory(token);
      }, 1000);
    } catch (err) {
      setConnectionStatus({ success: false, error: err.message });
    } finally {
      setConnectLoading(false);
    }
  };

  // 6. Generate SQL Prompt handler
  const handleGenerateQuery = async (e) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    setIsLoading(true);
    setError('');
    setResult(null);
    setExpandedCards({});
    setExecutionResults({});

    const token = localStorage.getItem('sql_token');

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userPrompt })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'API generation failed');
      }

      setResult(data);
      // Auto-expand the first card for nice UX
      setExpandedCards({ 0: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Execute SQL query handler
  const handleExecute = async (sql, index) => {
    setExecutionResults(prev => ({
      ...prev,
      [index]: { isLoading: true }
    }));

    const token = localStorage.getItem('sql_token');

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sql, userPrompt })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Query execution failed');
      }

      setExecutionResults(prev => ({
        ...prev,
        [index]: {
          isLoading: false,
          rows: data.rows,
          rowCount: data.rowCount,
          fields: data.fields,
          message: data.message,
          error: data.error
        }
      }));

      // Refresh query history logs list
      fetchHistory(token);
    } catch (err) {
      setExecutionResults(prev => ({
        ...prev,
        [index]: { isLoading: false, error: err.message }
      }));
    }
  };

  // Helper: Copy code block to clipboard
  const handleCopySql = (sql, index) => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopiedQueryIndex(index);
      setTimeout(() => setCopiedQueryIndex(null), 2000);
    });
  };

  // Helper: Toggle card explanation accordion
  const toggleExplanation = (index) => {
    setExpandedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Helpers for formatting risk tags
  const getRiskBadgeClass = (risk = 'low') => {
    const r = risk.toLowerCase();
    if (r.includes('high')) return 'risk-pill risk-high';
    if (r.includes('medium') || r.includes('mod')) return 'risk-pill risk-medium';
    return 'risk-pill risk-low';
  };

  // Format historical date
  const formatTime = (dateString) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  // --- RENDERING PAGES ---

  // LOGIN PAGE
  if (currentPage === 'login') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Pastel Query Generator</h2>
          <p className="auth-subtitle">Login to manage your database queries</p>
          
          {authError && <div className="error-banner">⚠️ {authError}</div>}
          
          <form className="auth-form" onSubmit={(e) => handleAuthSubmit(e, 'login')}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input type="email" id="email" name="email" required placeholder="name@company.com" />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" name="password" required placeholder="••••••••" />
            </div>
            <button type="submit" className="btn-primary" disabled={authLoading}>
              {authLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          <div className="auth-footer">
            Don't have an account?{' '}
            <span className="auth-link" onClick={() => { setAuthError(''); setCurrentPage('signup'); }}>
              Create Account
            </span>
          </div>
        </div>
      </div>
    );
  }

  // SIGNUP PAGE
  if (currentPage === 'signup') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Create Account</h2>
          <p className="auth-subtitle">Register to connect and execute queries</p>
          
          {authError && <div className="error-banner">⚠️ {authError}</div>}
          
          <form className="auth-form" onSubmit={(e) => handleAuthSubmit(e, 'signup')}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input type="email" id="email" name="email" required placeholder="name@company.com" />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" name="password" required placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input type="password" id="confirmPassword" name="confirmPassword" required placeholder="••••••••" />
            </div>
            <button type="submit" className="btn-primary" disabled={authLoading}>
              {authLoading ? 'Registering...' : 'Register'}
            </button>
          </form>
          <div className="auth-footer">
            Already have an account?{' '}
            <span className="auth-link" onClick={() => { setAuthError(''); setCurrentPage('login'); }}>
              Sign In
            </span>
          </div>
        </div>
      </div>
    );
  }

  // CONNECT DATABASE PAGE
  if (currentPage === 'connect') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header className="navbar">
          <div className="nav-logo">
            <div className="logo-icon">📊</div>
            <span>SQL Assistant</span>
          </div>
          <div className="nav-user">
            <span className="user-email">{userEmail}</span>
            <button className="btn-logout" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <div className="connect-container">
          <div className="connect-card">
            <h2>Connect Your Database</h2>
            <p className="connect-description">
              Provide your PostgreSQL connection string to configure multi-tenant database lookups. 
              We will run a temporary query to verify connection status before routing you to the query interface.
            </p>

            {connectionStatus && connectionStatus.error && (
              <div className="error-banner">⚠️ {connectionStatus.error}</div>
            )}
            
            {connectionStatus && connectionStatus.success && (
              <div className="info-box" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', color: '#2e7d32', marginBottom: '20px' }}>
                ✅ {connectionStatus.message}
              </div>
            )}

            <form className="auth-form" onSubmit={handleConnectDb}>
              <div className="form-group">
                <label htmlFor="connString">PostgreSQL Connection URI</label>
                <input
                  type="text"
                  id="connString"
                  placeholder="postgresql://db_user:password@host:port/database?sslmode=require"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  required
                  disabled={connectLoading}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={connectLoading || !connectionString.trim()}>
                {connectLoading ? 'Testing & Saving Connection...' : 'Test & Save Connection'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // MAIN EDITING DASHBOARD APPLICATION
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', maxHeight: '100vh' }}>
      <header className="navbar">
        <div className="nav-logo">
          <div className="logo-icon">📊</div>
          <span>SQL Assistant</span>
        </div>
        <div className="nav-user">
          <span className="user-email">{userEmail}</span>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="app-layout">
        {/* SIDEBAR QUERY HISTORY PANEL (30% WIDTH) */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Query History</h2>
          </div>
          <div className="history-list">
            {history.length > 0 ? (
              history.map((h) => (
                <div
                  key={h.id}
                  className="history-item"
                  onClick={() => setUserPrompt(h.user_prompt)}
                  title="Click to load prompt"
                >
                  <span className="history-time">{formatTime(h.executed_at)}</span>
                  <span className="history-prompt">{h.user_prompt}</span>
                </div>
              ))
            ) : (
              <div className="no-history">No queries executed yet</div>
            )}
          </div>
        </aside>

        {/* MAIN PANEL CONTENT (70% WIDTH) */}
        <main className="main-panel">
          <div className="prompt-section">
            <form onSubmit={handleGenerateQuery} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label htmlFor="mainPrompt" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                Ask SQL Generator in Plain English
              </label>
              <textarea
                id="mainPrompt"
                className="prompt-textarea"
                placeholder="e.g. Show all employees in the IT department with salary above 50,000"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                disabled={isLoading}
                required
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ alignSelf: 'flex-start', padding: '12px 24px', backgroundColor: 'var(--primary-dark)' }}
                disabled={isLoading || !userPrompt.trim()}
              >
                {isLoading ? 'Generating Query...' : 'Generate Query'}
              </button>
            </form>
          </div>

          {/* SKELETON LOADING STATE */}
          {isLoading && (
            <div className="skeleton-card">
              <div className="skeleton-title"></div>
              <div className="skeleton-code"></div>
              <div className="skeleton-text"></div>
              <div className="skeleton-text short"></div>
            </div>
          )}

          {/* ERROR VIEW */}
          {error && (
            <div className="error-box">
              <span>⚠️</span>
              <div>
                <strong>Generation Error:</strong> {error}
              </div>
            </div>
          )}

          {/* GENERATION RESULTS */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* AMBIGUITY NOTE */}
              {result.ambiguity_note && (
                <div className="info-box">
                  <span>ℹ️</span>
                  <div>
                    <strong>Ambiguity Note:</strong> {result.ambiguity_note}
                  </div>
                </div>
              )}

              {result.queries && result.queries.map((q, idx) => (
                <div key={idx} className="query-card">
                  
                  {/* CARD HEADER */}
                  <div className="query-card-header">
                    <span className="query-card-title">
                      Query {idx + 1} of {result.queries.length}
                    </span>
                    <span className={getRiskBadgeClass(q.risk_level)}>
                      {q.risk_level} Risk
                    </span>
                  </div>

                  {/* SQL CODE BLOCK WITH COPY */}
                  <div className="sql-block">
                    <pre className="sql-code">
                      <code>{q.sql}</code>
                    </pre>
                    <button
                      className="btn-copy"
                      onClick={() => handleCopySql(q.sql, idx)}
                    >
                      {copiedQueryIndex === idx ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  {/* EXPLANATION ACCORDION PANEL */}
                  <button
                    className="exp-toggle"
                    onClick={() => toggleExplanation(idx)}
                  >
                    <span>Explanation & Breakdown</span>
                    <span>{expandedCards[idx] ? '▲' : '▼'}</span>
                  </button>

                  {expandedCards[idx] && q.explanation && (
                    <div className="exp-content">
                      <div className="exp-summary">
                        {q.explanation.summary}
                      </div>

                      {/* CLAUSES break down cards */}
                      {q.explanation.clauses && q.explanation.clauses.length > 0 && (
                        <div className="clauses-container">
                          <span className="clauses-title">Clauses Used</span>
                          {q.explanation.clauses.map((c, cIdx) => (
                            <div key={cIdx} className="clause-card">
                              <span className="clause-badge">{c.clause}</span>
                              <span className="clause-desc">{c.description}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* JOINS, FILTERS, AGGREGATIONS rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <div className="detail-row">
                          <span className="detail-icon">🔗</span>
                          <div><strong>Joins:</strong> {q.explanation.joins}</div>
                        </div>
                        <div className="detail-row">
                          <span className="detail-icon">🔍</span>
                          <div><strong>Filters:</strong> {q.explanation.filters}</div>
                        </div>
                        <div className="detail-row">
                          <span className="detail-icon">📊</span>
                          <div><strong>Aggregations:</strong> {q.explanation.aggregations}</div>
                        </div>
                      </div>

                      {/* TABLES & ATTRIBUTES badges */}
                      {q.explanation.tables_and_attributes && q.explanation.tables_and_attributes.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                          <span className="clauses-title" style={{ display: 'block', marginBottom: '10px' }}>
                            Tables & Attributes
                          </span>
                          <div className="tags-container">
                            {q.explanation.tables_and_attributes.map((ta, taIdx) => (
                              <div key={taIdx} className="table-badge-group">
                                <span className="table-name-badge">{ta.table}</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {ta.attributes && ta.attributes.map((attr, aIdx) => (
                                    <span key={aIdx} className="attribute-tag">{attr}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* EFFICIENCY row */}
                      {q.explanation.efficiency && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', fontSize: '13px' }}>
                          <span className={`efficiency-label ${
                            q.explanation.efficiency.toLowerCase().includes('optimal') ? 'eff-optimal' :
                            q.explanation.efficiency.toLowerCase().includes('inefficient') ? 'eff-inefficient' : 'eff-acceptable'
                          }`}>
                            {q.explanation.efficiency.split(' ')[0]}
                          </span>
                          <span style={{ color: 'var(--text)' }}>
                            {q.explanation.efficiency.substring(q.explanation.efficiency.indexOf(' ') + 1) || q.explanation.efficiency}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* IMPACT SECTION */}
                  {q.impact && (
                    <div className="impact-section">
                      <div className="impact-row">
                        <span>📄</span>
                        <div><strong>Estimated Rows:</strong> {q.impact.estimated_rows}</div>
                      </div>

                      {q.impact.affected_rows && q.impact.affected_rows !== 'N/A' && (
                        <div className="impact-row">
                          <span>⚙️</span>
                          <div><strong>Affected Rows:</strong> {q.impact.affected_rows}</div>
                        </div>
                      )}

                      {q.impact.warnings && q.impact.warnings !== 'None' && (
                        <div className="yellow-warning-box">
                          <span>⚠️</span>
                          <div><strong>Warning:</strong> {q.impact.warnings}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* EXECUTE BUTTON & VIEWPORT */}
                  <div className="execute-area">
                    <button
                      className="btn-execute"
                      onClick={() => handleExecute(q.sql, idx)}
                      disabled={executionResults[idx]?.isLoading}
                    >
                      {executionResults[idx]?.isLoading ? 'Executing SQL...' : 'Execute Query'}
                    </button>

                    {executionResults[idx] && !executionResults[idx].isLoading && (
                      <div style={{ marginTop: '10px' }}>
                        
                        {/* SUCCESS MESSAGE */}
                        {executionResults[idx].message && (
                          <div className="execution-success" style={{ marginBottom: '10px' }}>
                            ✅ {executionResults[idx].message}
                          </div>
                        )}

                        {/* ERROR MESSAGE */}
                        {executionResults[idx].error && (
                          <div className="execution-error">
                            ⚠️ Error: {executionResults[idx].error}
                          </div>
                        )}

                        {/* SELECT RESULTS TABLE */}
                        {executionResults[idx].rows && executionResults[idx].rows.length > 0 && (
                          <div className="execution-viewport">
                            <table className="results-table">
                              <thead>
                                <tr>
                                  {executionResults[idx].fields && executionResults[idx].fields.map((f) => (
                                    <th key={f.name}>{f.name}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {executionResults[idx].rows.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {executionResults[idx].fields && executionResults[idx].fields.map((f) => (
                                      <td key={f.name}>{row[f.name] !== null ? String(row[f.name]) : 'NULL'}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {executionResults[idx].rows && executionResults[idx].rows.length === 0 && !executionResults[idx].error && (
                          <div className="info-box">
                            ℹ️ Query returned 0 rows successfully.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
