import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { userModel } from '../model/users.ts';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS, signAuthToken } from '../utils/token.ts';
import { loginUserSchema } from '../validator/user.ts';

const DUMMY_HASH = '$2b$12$m2kpKbwsVqoqZpHp9qBYne4uwVUcgTFMmPocpHoZu1VwcnyUfpOHa';

export async function loginUser(req: Request, res: Response): Promise<void> {
    const result = loginUserSchema.safeParse(req.body);

    if (!result.success) {
        res.status(400).json({ message: 'Données invalides', issues: z.flattenError(result.error) });
        return;
    }

    const { email, password } = result.data;

    try {
        // `passwordHash` est en `select: false` dans le schéma, il faut le demander.
        const user = await userModel.findOne({ email }).select('+passwordHash');
        const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

        // Un seul message pour les deux cas : ne pas révéler si l'email existe.
        if (user === null || !passwordMatches) {
            res.status(401).json({ message: 'Email ou mot de passe incorrect' });
            return;
        }

        res.cookie(AUTH_COOKIE_NAME, signAuthToken(user._id.toString()), AUTH_COOKIE_OPTIONS);
        res.status(200).json({
            id: user._id.toString(),
            email: user.email,
            displayName: user.displayName,
            skills: user.skills,
        });
    } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
}
