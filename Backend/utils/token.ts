import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../validator/config/env.ts';

const ALGORITHM = 'HS256';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const AUTH_COOKIE_NAME = 'token';

export const AUTH_COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
};

export function signAuthToken(userId: string): string {
    return jwt.sign({}, env.JWT_SECRET, {
        subject: userId,
        algorithm: ALGORITHM,
        expiresIn: TOKEN_TTL_SECONDS,
    });
}

/** Retourne l'id de l'utilisateur, ou `null` si le token est absurde, expiré ou falsifié. */
export function verifyAuthToken(token: string): string | null {
    try {
        // `algorithms` est obligatoire : sans lui, un token forgé en `alg: none` passerait.
        const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });

        if (typeof payload === 'string' || typeof payload.sub !== 'string') {
            return null;
        }

        return payload.sub;
    } catch {
        return null;
    }
}
