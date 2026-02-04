import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import type { HealthResponse, ApiError } from './types/index.js';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import mlbRoutes from './routes/mlb.js';
import teamRoutes from './routes/teams.js';
import gameRoutes from './routes/games.js';
import { createSocketServer } from './socket/index.js';

export function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));

  // Body parsing
  app.use(express.json());

  // Health check endpoint (no auth required)
  app.get('/health', (_req: Request, res: Response<HealthResponse>) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Protected routes use auth middleware
  app.get('/api/protected', authMiddleware, (req: Request, res: Response) => {
    res.json({ message: 'You are authenticated', user: (req as unknown as { user: unknown }).user });
  });

  // Auth routes (no auth required)
  app.use('/api/auth', authRoutes);

  // MLB routes
  app.use('/api/mlb', mlbRoutes);

  // Team routes
  app.use('/api/teams', teamRoutes);

  // Game routes
  app.use('/api/games', gameRoutes);

  // 404 handler
  app.use((_req: Request, res: Response<ApiError>) => {
    res.status(404).json({
      error: 'not_found',
      message: 'Endpoint not found',
    });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response<ApiError>, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      error: 'internal_error',
      message: 'An internal server error occurred',
    });
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  const io = createSocketServer(httpServer);

  return { app, httpServer, io };
}
