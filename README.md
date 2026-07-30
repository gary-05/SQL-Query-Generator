# SQL Query Generator & Analyzer

A high-fidelity, full-stack database helper application designed to translate natural language prompts into optimized, secure PostgreSQL queries. Built using React and Node.js/Express, this application connects to custom PostgreSQL instances and leverages Llama-3.3 on Groq API to provide granular query performance insights, clause breakdowns, and risk assessments.

---

## 🚀 Key Features

- **Secure User Accounts & Sessions**:
  - JWT-based authentication storing session tokens securely in `localStorage`.
  - Password encryption using `bcryptjs` (10 salt rounds).
  - State-based routing to keep session views separate without routing library bulk.

- **Dynamic Database Connection Setup**:
  - Safely connect to your own custom PostgreSQL database.
  - Verifies database credentials using a temporary pool and `SELECT 1` ping before saving.
  - Multi-tenant connection caching to isolate user pools and prevent cross-user performance degradation.

- **Natural Language to SQL Generation**:
  - Translate prompts (e.g., *"Find the average salary of employees in IT"* ) into valid, table-validated PostgreSQL.
  - Supports schema inspection, mapping table columns dynamically without guessing schema items.

- **AI-Powered Query Explanations**:
  - **Summary**: Simple plain English descriptions of the query logic.
  - **Clauses Used**: Labeled breakdown cards showing the exact purpose of clauses (`SELECT`, `WHERE`, `JOIN`, etc.).
  - **Detail Grid**: Shows specific joins, filters, and mathematical aggregations used.
  - **Table Attribute Map**: Inspect tables used and the exact attributes returned.
  - **Efficiency Rating**: Rated as `Optimal`, `Acceptable`, or `Inefficient` (identifying full-table scan risks or missing indexes).

- **Risk Assessments & Safety Banners**:
  - High risk level (Red badge) for updates, deletions, or irreversible actions.
  - Warning box flags queries attempting updates or deletes without a `WHERE` clause, or large selects without `LIMIT`.

- **Inline Direct SQL Execution**:
  - Run generated queries directly on your target database.
  - Displays output in scrollable data grids or shows row update confirmation notices.

- **Private Query Logs & Sidebar History**:
  - Retains your last 20 queries, stored in the application's private Neon database.
  - Click on any historical sidebar log to instantly load the original prompt back into the editor.

---

## 🛠️ Technology Stack

- **Frontend (React)**:
  - Vite (build compiler)
  - Vanilla CSS (custom styles reset & pastel themes)
  - Local session managers
- **Backend (Express API)**:
  - Node.js
  - pg (PostgreSQL connection pool driver)
  - jsonwebtoken (Token generators)
  - bcryptjs (Hashing algorithm)
  - axios (HTTP request handler for AI completions)
- **AI Completion Engine**:
  - Groq Cloud API (`llama-3.3-70b-versatile` LLM)

---

## ⚙️ Environment Variables Setup

Create a `.env` file inside the `server` directory and add the following keys:

```ini
# Application Port
PORT=5000

# App database - Neon PostgreSQL URL (stores user logins & history log records)
DATABASE_URL=postgresql://your_neon_db_url_here

# JWT Signing Secret
JWT_SECRET=your_jwt_signing_secret_here

# Groq Cloud API Key (for query generations)
GROQ_API_KEY=gsk_your_groq_api_key_here

# User database connection credentials (fallback/defaults for test runs)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=your_database_name
```

---

## 🏃 Steps to Run the Project

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### 1. Start the Backend API Server
Open a terminal, navigate to the `server` directory, install dependencies, and start the development server:
```bash
cd server
npm install
npm run dev
```
*(The backend server will run on `http://localhost:5000` and automatically restart on file changes).*

### 2. Start the Frontend Client
Open a separate terminal window, navigate to the `client` directory, install dependencies, and launch the Vite dev server:
```bash
cd client
npm install
npm run dev
```
*(The client application will run on `http://localhost:5173`. Any requests directed to `/api/*` are automatically proxied to the Express backend).*

---

## 🔌 API Reference Guide

### Authentication
- `POST /api/auth/signup`: Accepts `{ email, password }` and registers a new account. Returns JWT token.
- `POST /api/auth/login`: Accepts `{ email, password }` and validates credentials. Returns JWT token.

### Connection Management
- `POST /api/connection`: Accepts `{ connectionString }` and validates, pings, and configures the user's custom DB.
- `GET /api/connection/status`: Check if the authenticated user has configured their connection string.

### Database Workspaces
- `GET /api/schema`: Inspects tables, attributes, and structures in the user's target database.
- `POST /api/query`: Submits `{ userPrompt }` and returns the generated SQL query and detailed explanation metrics.
- `POST /api/execute`: Accepts `{ sql, userPrompt }`, runs it on the user's connection pool, and returns matching datasets or metrics.
- `GET /api/history`: Returns the last 20 queries executed by the user.
