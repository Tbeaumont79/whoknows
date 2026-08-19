import type { Request, Response } from 'express';
import mongoose, { type HydratedDocument, type UpdateQuery } from 'mongoose';
import { z } from 'zod';
import { AnswerModel, type Answer } from '../model/answers.ts';
import { QuestionModel, type Question } from '../model/questions.ts';
import { userModel } from '../model/users.ts';
import {
    answerIdParamSchema,
    createAnswerSchema,
    listAnswersQuerySchema,
    questionIdParamSchema,
    updateAnswerSchema,
} from '../validator/answer.ts';

const SERVER_ERROR = 'Erreur interne du serveur';
const ANSWER_NOT_FOUND = 'Réponse introuvable';
const QUESTION_NOT_FOUND = 'Question introuvable';

// Sentinelle pour annuler une transaction et la distinguer d'une vraie panne.
const QUESTION_GONE = 'question-supprimee-pendant-la-transaction';

function isQuestionGone(error: unknown): boolean {
    return error instanceof Error && error.message === QUESTION_GONE;
}

function toAnswerResponse(answer: HydratedDocument<Answer>) {
    return {
        id: answer._id.toString(),
        questionId: answer.questionId.toString(),
        body: answer.body,
        author: {
            id: answer.author._id.toString(),
            displayName: answer.author.displayName,
        },
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt,
    };
}

export async function createAnswer(req: Request, res: Response): Promise<void> {
    if (req.userId === undefined) {
        res.status(401).json({ message: 'Authentification requise' });
        return;
    }

    const parsedId = questionIdParamSchema.safeParse(req.params);

    if (!parsedId.success) {
        res.status(400).json({ message: 'Identifiant de question invalide' });
        return;
    }

    const parsed = createAnswerSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ message: 'Données invalides', issues: z.flattenError(parsed.error) });
        return;
    }

    try {
        const author = await userModel.findById(req.userId);

        if (author === null) {
            res.status(401).json({ message: 'Session invalide ou expirée' });
            return;
        }

        const session = await mongoose.startSession();
        let answer: HydratedDocument<Answer> | undefined;

        try {
            await session.withTransaction(async () => {
                // Incrémenter AVANT d'insérer n'est pas un détail : cette écriture sur la
                // question sert de verrou. Une suppression concurrente de la question
                // écrit le même document, donc l'une des deux transactions part en
                // WriteConflict et rejoue. Vérifier l'existence par un findById hors
                // transaction ne sérialise rien et laisse passer des réponses orphelines.
                const touched = await QuestionModel.updateOne(
                    { _id: parsedId.data.id },
                    { $inc: { answerCount: 1 } },
                    { session },
                );

                if (touched.matchedCount === 0) {
                    throw new Error(QUESTION_GONE);
                }

                const [created] = await AnswerModel.create(
                    [
                        {
                            questionId: parsedId.data.id,
                            body: parsed.data.body,
                            author: { _id: author._id, displayName: author.displayName },
                        },
                    ],
                    { session },
                );

                answer = created;
            });
        } finally {
            await session.endSession();
        }

        if (answer === undefined) {
            res.status(500).json({ message: SERVER_ERROR });
            return;
        }

        res.status(201).json(toAnswerResponse(answer));
    } catch (error: unknown) {
        if (isQuestionGone(error)) {
            res.status(404).json({ message: QUESTION_NOT_FOUND });
            return;
        }

        console.error(error);
        res.status(500).json({ message: SERVER_ERROR });
    }
}

export async function listAnswers(req: Request, res: Response): Promise<void> {
    const parsedId = questionIdParamSchema.safeParse(req.params);

    if (!parsedId.success) {
        res.status(400).json({ message: 'Identifiant de question invalide' });
        return;
    }

    const parsed = listAnswersQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        res.status(400).json({ message: 'Paramètres invalides', issues: z.flattenError(parsed.error) });
        return;
    }

    const { page, limit } = parsed.data;

    try {
        const questionExists = await QuestionModel.exists({ _id: parsedId.data.id });

        if (questionExists === null) {
            res.status(404).json({ message: QUESTION_NOT_FOUND });
            return;
        }

        // Ordre chronologique : c'est celui de l'index { questionId: 1, createdAt: 1 }.
        const [answers, total] = await Promise.all([
            AnswerModel.find({ questionId: parsedId.data.id })
                .sort({ createdAt: 1 })
                .skip((page - 1) * limit)
                .limit(limit),
            AnswerModel.countDocuments({ questionId: parsedId.data.id }),
        ]);

        res.status(200).json({
            items: answers.map(toAnswerResponse),
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ message: SERVER_ERROR });
    }
}

export async function updateAnswer(req: Request, res: Response): Promise<void> {
    if (req.userId === undefined) {
        res.status(401).json({ message: 'Authentification requise' });
        return;
    }

    const parsedId = answerIdParamSchema.safeParse(req.params);

    if (!parsedId.success) {
        res.status(400).json({ message: 'Identifiant de réponse invalide' });
        return;
    }

    const parsed = updateAnswerSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ message: 'Données invalides', issues: z.flattenError(parsed.error) });
        return;
    }

    try {
        const answer = await AnswerModel.findById(parsedId.data.id);

        if (answer === null) {
            res.status(404).json({ message: ANSWER_NOT_FOUND });
            return;
        }

        if (answer.author._id.toString() !== req.userId) {
            res.status(403).json({ message: 'Seul l\'auteur peut modifier cette réponse' });
            return;
        }

        answer.body = parsed.data.body;
        await answer.save();

        res.status(200).json(toAnswerResponse(answer));
    } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ message: SERVER_ERROR });
    }
}

export async function deleteAnswer(req: Request, res: Response): Promise<void> {
    if (req.userId === undefined) {
        res.status(401).json({ message: 'Authentification requise' });
        return;
    }

    const parsedId = answerIdParamSchema.safeParse(req.params);

    if (!parsedId.success) {
        res.status(400).json({ message: 'Identifiant de réponse invalide' });
        return;
    }

    try {
        const answer = await AnswerModel.findById(parsedId.data.id);

        if (answer === null) {
            res.status(404).json({ message: ANSWER_NOT_FOUND });
            return;
        }

        if (answer.author._id.toString() !== req.userId) {
            res.status(403).json({ message: 'Seul l\'auteur peut supprimer cette réponse' });
            return;
        }

        const session = await mongoose.startSession();
        let deleted = false;

        try {
            await session.withTransaction(async () => {
                // `deletedCount` est la seule preuve que c'est bien NOUS qui avons
                // supprimé. Deux DELETE concurrents passent tous les deux le 404
                // ci-dessus ; décrémenter sans cette garde fait dériver `answerCount`,
                // jusqu'à le rendre négatif (`min: 0` ne s'applique pas à un $inc).
                const result = await AnswerModel.deleteOne({ _id: answer._id }, { session });

                deleted = result.deletedCount === 1;

                if (!deleted) {
                    return;
                }

                // Lu dans la transaction : hors session, on pourrait manquer une
                // acceptation validée entre-temps.
                const question = await QuestionModel.findById(answer.questionId, null, { session });
                const update: UpdateQuery<Question> = { $inc: { answerCount: -1 } };

                // Supprimer la réponse acceptée doit rouvrir la question, sinon elle
                // reste « resolved » en pointant vers un document qui n'existe plus.
                if (question?.acceptedAnswerId?.toString() === answer._id.toString()) {
                    update.$set = { acceptedAnswerId: null, status: 'open' };
                }

                await QuestionModel.updateOne({ _id: answer.questionId }, update, { session });
            });
        } finally {
            await session.endSession();
        }

        if (!deleted) {
            res.status(404).json({ message: ANSWER_NOT_FOUND });
            return;
        }

        res.status(204).end();
    } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ message: SERVER_ERROR });
    }
}
