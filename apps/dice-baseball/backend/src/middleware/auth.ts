import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest, JWTPayload, ApiError } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response<ApiError>,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Missing authorization header',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid authorization header format',
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // TokenExpiredError extends JsonWebTokenError, so check it first
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'Token has expired',
      });
      return;
    }

    // All other JWT errors (malformed, invalid signature, etc.)
    res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid token',
    });
  }
}
