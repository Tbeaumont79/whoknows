import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../utils/token.ts';

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const token: unknown = req.cookies[AUTH_COOKIE_NAME];

    if (typeof token !== 'string') {
        res.status(401).json({ message: 'Authentification requise' });
        return;
    }

    const userId = verifyAuthToken(token);

    if (userId === null) {
        res.status(401).json({ message: 'Session invalide ou expirée' });
        return;
    }

    req.userId = userId;
    next();
}
