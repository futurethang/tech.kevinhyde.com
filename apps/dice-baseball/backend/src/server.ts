import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { HealthResponse, ApiError } from './types/index.js';
import { authMiddleware } from './middleware/auth.js';
import mlbRoutes from './routes/mlb.js';

export function createApp(): Express {
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

  // MLB routes
  app.use('/api/mlb', mlbRoutes);

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

  return app;
}
