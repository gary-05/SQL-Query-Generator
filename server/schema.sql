-- PostgreSQL Database Schema Setup
-- Execute this script to create the necessary tables in your PostgreSQL database.

-- Table: query_history
CREATE TABLE IF NOT EXISTS query_history (
  id SERIAL PRIMARY KEY,
  user_prompt TEXT,
  generated_sql TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Note: In public schema we also assume columns for employees and departments exist:
-- CREATE TABLE IF NOT EXISTS departments (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(100) NOT NULL
-- );
-- CREATE TABLE IF NOT EXISTS employees (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(100) NOT NULL,
--   salary NUMERIC(10, 2),
--   department_id INTEGER REFERENCES departments(id)
-- );
