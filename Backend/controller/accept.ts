import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AnswerModel } from '../model/answers.ts';
import { QuestionModel } from '../model/questions.ts';
import { shiftAcceptedByTag } from '../utils/reputation.ts';
import { acceptAnswerSchema, questionIdParamSchema } from '../validator/question.ts';

const SERVER_ERROR = 'Erreur interne du serveur';

// Sentinelle : sortir d'une transaction se fait en levant. Le détail du refus
// voyage dans `failure` plutôt que dans le message d'erreur.
const ABORT = 'accept-abort';

type Failure = { status: number; message: string };

export async function acceptAnswer(req: Request, res: Response): Promise<void> {
    if (req.userId === undefined) {
        res.status(401).json({ message: 'Authentification requise' });
        return;
    }

    const parsedId = questionIdParamSchema.safeParse(req.params);

    if (!parsedId.success) {
        res.status(400).json({ message: 'Identifiant de question invalide' });
        return;
    }

    const parsed = acceptAnswerSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ message: 'Données invalides', issues: z.flattenError(parsed.error) });
        return;
    }

    const { id: questionId } = parsedId.data;
    const { answerId } = parsed.data;

    try {
        const session = await mongoose.startSession();
        let failure: Failure | undefined;

        try {
            await session.withTransaction(async () => {
                // withTransaction peut rejouer le bloc : on repart d'un état vierge.
                failure = undefined;

                const reject = (status: number, message: string): never => {
                    failure = { status, message };
                    throw new Error(ABORT);
                };

                // Tout est lu dans la session : une acceptation concurrente ne doit
                // pas passer inaperçue entre la lecture et l'écriture.
                const question = await QuestionModel.findById(questionId, null, { session });

                if (question === null) {
                    reject(404, 'Question introuvable');
                    return;
                }

                if (question.author._id.toString() !== req.userId) {
                    reject(403, 'Seul l\'auteur de la question peut accepter une réponse');
                    return;
                }

                const answer = await AnswerModel.findById(answerId, null, { session });

                if (answer === null || answer.questionId.toString() !== questionId) {
                    reject(404, 'Cette réponse n\'appartient pas à cette question');
                    return;
                }

                // La réputation sert à répondre à « qui s'y connaît en X ? » :
                // s'auto-accepter permettrait de la fabriquer seul.
                if (answer.author._id.toString() === question.author._id.toString()) {
                    reject(403, 'On ne peut pas accepter sa propre réponse');
                    return;
                }

                const previousAnswerId = question.acceptedAnswerId;

                // Idempotent : ré-accepter la même réponse ne doit rien recompter.
                if (previousAnswerId?.toString() === answerId) {
                    return;
                }

                // Verrou optimiste : la mise à jour n'a lieu que si personne n'a
                // accepté entre-temps, sinon on recompterait sur un état périmé.
                const touched = await QuestionModel.updateOne(
                    { _id: question._id, acceptedAnswerId: previousAnswerId ?? null },
                    { $set: { acceptedAnswerId: answer._id, status: 'resolved' } },
                    { session },
                );

                if (touched.matchedCount === 0) {
                    reject(409, 'Une autre acceptation vient d\'avoir lieu, réessayez');
                    return;
                }

                // Changement d'avis : l'ancien auteur perd ce qu'il avait gagné,
                // sinon la réputation se crée à partir de rien à chaque bascule.
                if (previousAnswerId !== null && previousAnswerId !== undefined) {
                    const previous = await AnswerModel.findById(previousAnswerId, null, { session });

                    if (previous !== null) {
                        await shiftAcceptedByTag(previous.author._id, question.tags, -1, session);
                    }
                }

                await shiftAcceptedByTag(answer.author._id, question.tags, 1, session);
            });
        } catch (error: unknown) {
            // Seule l'annulation volontaire est absorbée ici : toute autre erreur
            // reste une panne et doit remonter.
            if (!(error instanceof Error) || error.message !== ABORT) {
                throw error;
            }
        } finally {
            await session.endSession();
        }

        if (failure !== undefined) {
            res.status(failure.status).json({ message: failure.message });
            return;
        }

        const question = await QuestionModel.findById(questionId);

        if (question === null) {
            res.status(404).json({ message: 'Question introuvable' });
            return;
        }

        res.status(200).json({
            id: question._id.toString(),
            status: question.status,
            acceptedAnswerId: question.acceptedAnswerId?.toString() ?? null,
        });
    } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ message: SERVER_ERROR });
    }
}
