/**
 * Auth Routes - User registration and login
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { JWTPayload, ApiError } from '../types/index.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';
const TOKEN_EXPIRY = '7d';

// In-memory user storage (for development)
interface StoredUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

const users: Map<string, StoredUser> = new Map();
const emailIndex: Map<string, string> = new Map(); // email -> id

// ============================================
// REGISTER
// ============================================

interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

router.post('/register', async (req: Request, res: Response<{ user: { id: string; email: string; username: string }; token: string } | ApiError>) => {
  try {
    const { email, username, password } = req.body as RegisterRequest;

    // Validation
    if (!email || !username || !password) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Email, username, and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Password must be at least 8 characters',
      });
    }

    // Check if email already exists
    if (emailIndex.has(email.toLowerCase())) {
      return res.status(409).json({
        error: 'conflict',
        message: 'Email already registered',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const id = uuidv4();
    const user: StoredUser = {
      id,
      email: email.toLowerCase(),
      username,
      passwordHash,
      createdAt: new Date(),
    };

    users.set(id, user);
    emailIndex.set(email.toLowerCase(), id);

    // Generate token
    const payload: JWTPayload = {
      sub: id,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'An internal server error occurred',
    });
  }
});

// ============================================
// LOGIN
// ============================================

interface LoginRequest {
  email: string;
  password: string;
}

router.post('/login', async (req: Request, res: Response<{ user: { id: string; email: string; username: string }; token: string } | ApiError>) => {
  try {
    const { email, password } = req.body as LoginRequest;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Email and password are required',
      });
    }

    // Find user
    const userId = emailIndex.get(email.toLowerCase());
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid email or password',
      });
    }

    const user = users.get(userId);
    if (!user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'An internal server error occurred',
    });
  }
});

// ============================================
// CLEAR (for testing)
// ============================================

export function clearUsers(): void {
  users.clear();
  emailIndex.clear();
}

export default router;
