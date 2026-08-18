import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { mongo } from 'mongoose';
import { z } from 'zod';
import { userModel } from '../model/users.ts';
import { registerUserSchema } from '../validator/user.ts';

const SALT_ROUNDS = 12;
// 11000 = doublon sur index unique
const DUPLICATE_KEY_CODE = 11_000;

export async function registerUser(req: Request, res: Response): Promise<void> {
    const result = registerUserSchema.safeParse(req.body);

    if (!result.success) {
        res.status(400).json({ message: 'Données invalides', issues: z.flattenError(result.error) });
        return;
    }

    const { email, displayName, password, skills } = result.data;

    try {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await userModel.create({ email, displayName, passwordHash, skills });

        res.status(201).json({
            id: user._id.toString(),
            email: user.email,
            displayName: user.displayName,
            skills: user.skills,
        });
    } catch (error: unknown) {
        if (error instanceof mongo.MongoServerError && error.code === DUPLICATE_KEY_CODE) {
            res.status(409).json({ message: 'Un compte existe déjà avec cet email' });
            return;
        }

        console.error(error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
}
