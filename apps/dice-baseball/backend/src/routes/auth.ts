/**
 * Auth Routes - User registration and login
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { JWTPayload, ApiError } from '../types/index.js';
import { createTeam, updateRoster } from '../services/team-service.js';
import type { RosterSlot } from '../services/roster-validation.js';

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

function createTokenForUser(user: StoredUser): string {
  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

async function createStoredUser(email: string, username: string, password: string): Promise<StoredUser> {
  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const user: StoredUser = {
    id,
    email: email.toLowerCase(),
    username,
    passwordHash,
    createdAt: new Date(),
  };

  users.set(id, user);
  emailIndex.set(user.email, id);

  return user;
}

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

    const user = await createStoredUser(email, username, password);
    const token = createTokenForUser(user);

    // For Quick Dev login (test accounts), create default teams with rosters
    if (email.includes('test') && email.includes('example.com')) {
      await createDefaultTeams(user.id);
    }

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
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

    const token = createTokenForUser(user);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
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

export interface DevUserSeed {
  id: string;
  email: string;
  username: string;
  token: string;
}

export async function createDevUserWithDefaultTeams(
  label: string,
  password: string = 'password123'
): Promise<DevUserSeed> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const email = `test-${label}-${suffix}@example.com`;
  const username = `Dev${label}${suffix.slice(-5)}`;

  const user = await createStoredUser(email, username, password);
  await createDefaultTeams(user.id);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    token: createTokenForUser(user),
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Creates default teams with full rosters for quick dev login
 */
async function createDefaultTeams(userId: string): Promise<void> {
  try {
    // Create Team 1 - All-Stars
    const team1 = await createTeam(userId, 'All-Stars');
    
    // Roster for Team 1
    const roster1: RosterSlot[] = [
      // Position players (batting order 1-9)
      { position: 'CF', mlbPlayerId: 545361, battingOrder: 1 },  // Mike Trout
      { position: '2B', mlbPlayerId: 514888, battingOrder: 2 },  // Jose Altuve  
      { position: 'RF', mlbPlayerId: 660271, battingOrder: 3 },  // Juan Soto
      { position: '1B', mlbPlayerId: 592450, battingOrder: 4 },  // Freddie Freeman
      { position: '3B', mlbPlayerId: 571448, battingOrder: 5 },  // Nolan Arenado
      { position: 'SS', mlbPlayerId: 666971, battingOrder: 6 },  // Bo Bichette
      { position: 'LF', mlbPlayerId: 665742, battingOrder: 7 },  // Cody Bellinger
      { position: 'C', mlbPlayerId: 668939, battingOrder: 8 },   // Willson Contreras
      { position: 'DH', mlbPlayerId: 605141, battingOrder: 9 },  // Mookie Betts
      // Pitcher (no batting order)
      { position: 'SP', mlbPlayerId: 543037, battingOrder: null }, // Gerrit Cole
    ];

    await updateRoster(team1.id, roster1);
    console.log(`✅ Created team "${team1.name}" for user ${userId}`);

    // Create Team 2 - Legends
    const team2 = await createTeam(userId, 'Legends');
    
    // Roster for Team 2 (different players)
    const roster2: RosterSlot[] = [
      // Position players (batting order 1-9)
      { position: 'SS', mlbPlayerId: 608070, battingOrder: 1 },  // Trea Turner
      { position: 'RF', mlbPlayerId: 502671, battingOrder: 2 },  // Alex Bregman  
      { position: 'CF', mlbPlayerId: 660271, battingOrder: 3 },  // Juan Soto
      { position: '1B', mlbPlayerId: 519317, battingOrder: 4 },  // Paul Goldschmidt
      { position: '3B', mlbPlayerId: 592518, battingOrder: 5 },  // Manny Machado
      { position: 'LF', mlbPlayerId: 592450, battingOrder: 6 },  // Freddie Freeman
      { position: 'C', mlbPlayerId: 543521, battingOrder: 7 },   // Salvador Perez
      { position: '2B', mlbPlayerId: 666971, battingOrder: 8 },   // Bo Bichette
      { position: 'DH', mlbPlayerId: 514888, battingOrder: 9 },  // Jose Altuve
      // Pitcher (no batting order)
      { position: 'SP', mlbPlayerId: 605400, battingOrder: null }, // Jacob deGrom
    ];

    await updateRoster(team2.id, roster2);
    console.log(`✅ Created team "${team2.name}" for user ${userId}`);
    
  } catch (error) {
    console.error('Error creating default teams:', error);
    // Don't throw - this is a nice-to-have feature, not critical
  }
}

export default router;
