import type { Request, Response } from 'express';
import { userModel } from '../model/users.ts';

export async function getMe(req: Request, res: Response): Promise<void> {
    if (req.userId === undefined) {
        res.status(401).json({ message: 'Authentification requise' });
        return;
    }

    try {
        const user = await userModel.findById(req.userId);

        if (user === null) {
            res.status(401).json({ message: 'Session invalide ou expirée' });
            return;
        }

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
