import type { ClientSession, Types } from 'mongoose';
import { userModel } from '../model/users.ts';

/**
 * Décale de `delta` le compteur d'acceptations d'un utilisateur, pour chaque tag.
 *
 * Doit être appelé dans une transaction : plusieurs documents utilisateurs peuvent
 * bouger pour une seule acceptation (le nouvel auteur, et l'ancien si la question
 * change de réponse acceptée).
 */
export async function shiftAcceptedByTag(
    userId: Types.ObjectId,
    tags: string[],
    delta: 1 | -1,
    session: ClientSession,
): Promise<void> {
    for (const tag of tags) {
        // Sur un décrément, `count: { $gt: 0 }` tient le plancher : le `min: 0`
        // du schéma ne s'applique pas à un $inc, comme pour answerCount.
        const element = delta > 0 ? { tag } : { tag, count: { $gt: 0 } };

        const touched = await userModel.updateOne(
            { _id: userId, 'stats.acceptedByTag': { $elemMatch: element } },
            { $inc: { 'stats.acceptedByTag.$.count': delta } },
            { session },
        );

        // MongoDB ne sait pas $inc dans un élément de tableau absent : on le crée.
        if (touched.matchedCount === 0 && delta > 0) {
            await userModel.updateOne(
                { _id: userId },
                { $push: { 'stats.acceptedByTag': { tag, count: 1 } } },
                { session },
            );
        }
    }
}
