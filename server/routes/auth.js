import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/userDb.js';

const router = express.Router();
const saltRounds = 10;

// In-memory users array for mock fallback in development
export const mockUsers = [];

router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const isPlaceholder = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your_');

  try {
    let userId;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    if (isPlaceholder) {
      const existingUser = mockUsers.find(u => u.email === email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      userId = mockUsers.length + 1;
      mockUsers.push({ id: userId, email, password_hash: passwordHash });
      console.log(`Mock DB User signed up: ${email} (ID: ${userId})`);
    } else {
      const result = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, passwordHash]
      );
      userId = result.rows[0].id;
    }

    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return res.json({ token, userId, email });
  } catch (err) {
    console.error('Signup error:', err);
    if (err.code === '23505') { // Unique constraint violation (email unique)
      return res.status(400).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Failed to complete signup: ' + err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const isPlaceholder = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your_');

  try {
    let user;
    if (isPlaceholder) {
      user = mockUsers.find(u => u.email === email);
    } else {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return res.json({ token, userId: user.id, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to log in: ' + err.message });
  }
});

export default router;
