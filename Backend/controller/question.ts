import type { Request, Response } from 'express';
import type { HydratedDocument, QueryFilter, SortOrder } from 'mongoose';
import { z } from 'zod';
import { AnswerModel } from '../model/answers.ts';
import { QuestionModel, type Question } from '../model/questions.ts';
import { tagModel } from '../model/tags.ts';
import { userModel } from '../model/users.ts';
import {
    createQuestionSchema,
    listQuestionsQuerySchema,
    questionIdParamSchema,
    updateQuestionSchema,
} from '../validator/question.ts';

const SERVER_ERROR = 'Erreur interne du serveur';
const NOT_FOUND = 'Question introuvable';

type QuestionSort = Record<string, SortOrder | { $meta: 'textScore' }>;

function toQuestionResponse(question: HydratedDocument<Question>) {
    return {
        id: question._id.toString(),
        title: question.title,
        body: question.body,
        tags: question.tags,
        status: question.status,
        author: {
            id: question.author._id.toString(),
            displayName: question.author.displayName,
        },
        acceptedAnswerId: question.acceptedAnswerId?.toString() ?? null,
        answerCount: question.answerCount,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
    };
}

/** Les tags sont stockés en clair dans la question : on vérifie qu'ils existent vraiment. */
async function findUnknownTags(tags: string[]): Promise<string[]> {
    const existing = await tagModel.find({ slug: { $in: tags } }).select('slug');
    const known = new Set(existing.map((tag) => tag.slug));

    return tags.filter((tag) => !known.has(tag));
}

export async function createQuestion(req: Request, res: Response): Promise<void> {
    if (req.userId === undefined) {
        res.status(401).json({ message: 'Authentification requise' });
        return;
    }

    const parsed = createQuestionSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ message: 'Données invalides', issues: z.flattenError(parsed.error) });
        return;
    }

    const { title, body, tags } = parsed.data;

    try {
        const unknownTags = await findUnknownTags(tags);

        if (unknownTags.length > 0) {
            res.status(400).json({ message: `Tags inconnus : ${unknownTags.join(', ')}` });
            return;
        }

        const author = await userModel.findById(req.userId);

        if (author === null) {
            res.status(401).json({ message: 'Session invalide ou expirée' });
            return;
        }

        // `author` est un snapshot et non une référence : le displayName est figé
        // au moment de la création, ce qui évite un populate sur chaque liste.
        const question = await QuestionModel.create({
            title,
            body,
            tags,
            author: { _id: author._id, displayName: author.displayName },
        });

        res.status(201).json(toQuestionResponse(question));
    } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ message: SERVER_ERROR });
    }
}

export async function listQuestions(req: Request, res: Response): Promise<void> {
    const parsed = listQuestionsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        res.status(400).json({ message: 'Paramètres invalides', issues: z.flattenError(parsed.error) });
        return;
    }

    const { tag, status, q, page, limit } = parsed.data;
    const filter: QueryFilter<Question> = {};

    if (tag !== undefined) {
        filter.tags = tag;
    }
    if (status !== undefined) {
        filter.status = status;
    }
    if (q !== undefined) {
        filter.$text = { $search: q };
    }

    // Sur une recherche, la pertinence prime sur la date.
    const sort: QuestionSort = q === undefined ? { createdAt: -1 } : { score: { $meta: 'textScore' } };

    try {
        const [questions, total] = await Promise.all([
            QuestionModel.find(filter)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit),
            QuestionModel.countDocuments(filter),
        ]);

        res.status(200).json({
            items: questions.map(toQuestionResponse),
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

export async function getQuestion(req: Request, res: Response): Promise<void> {
    const parsed = questionIdParamSchema.safeParse(req.params);

    if (!parsed.success) {
        res.status(400).json({ message: 'Identifiant de question invalide' });
        return;
    }

    try {
        const question = await QuestionModel.findById(parsed.data.id);

        if (question === null) {
            res.status(404).json({ message: NOT_FOUND });
            return;
        }

        res.status(200).json(toQuestionResponse(question));
    } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ message: SERVER_ERROR });
    }
}

export async function updateQuestion(req: Request, res: Response): Promise<void> {
    if (req.userId === undefined) {
        res.status(401).json({ message: 'Authentification requise' });
        return;
    }

    const parsedId = questionIdParamSchema.safeParse(req.params);

    if (!parsedId.success) {
        res.status(400).json({ message: 'Identifiant de question invalide' });
        return;
    }

    const parsed = updateQuestionSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ message: 'Données invalides', issues: z.flattenError(parsed.error) });
        return;
    }

    const { title, body, tags } = parsed.data;

    try {
        const question = await QuestionModel.findById(parsedId.data.id);

        if (question === null) {
            res.status(404).json({ message: NOT_FOUND });
            return;
        }

        if (question.author._id.toString() !== req.userId) {
            res.status(403).json({ message: 'Seul l\'auteur peut modifier cette question' });
            return;
        }

        if (tags !== undefined) {
            const unknownTags = await findUnknownTags(tags);

            if (unknownTags.length > 0) {
                res.status(400).json({ message: `Tags inconnus : ${unknownTags.join(', ')}` });
                return;
            }

            question.tags = tags;
        }
        if (title !== undefined) {
            question.title = title;
        }
        if (body !== undefined) {
            question.body = body;
        }

        await question.save();

        res.status(200).json(toQuestionResponse(question));
    } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ message: SERVER_ERROR });
    }
}

export async function deleteQuestion(req: Request, res: Response): Promise<void> {
    if (req.userId === undefined) {
        res.status(401).json({ message: 'Authentification requise' });
        return;
    }

    const parsed = questionIdParamSchema.safeParse(req.params);

    if (!parsed.success) {
        res.status(400).json({ message: 'Identifiant de question invalide' });
        return;
    }

    try {
        const question = await QuestionModel.findById(parsed.data.id);

        if (question === null) {
            res.status(404).json({ message: NOT_FOUND });
            return;
        }

        if (question.author._id.toString() !== req.userId) {
            res.status(403).json({ message: 'Seul l\'auteur peut supprimer cette question' });
            return;
        }

        // Idéalement une transaction, mais le MongoDB local tourne en standalone
        // et les transactions exigent un replica set : on ordonne donc les
        // suppressions pour que le pire cas soit récupérable.
        // Les réponses d'abord — une coupure laisse alors une
        // question au answerCount périmé, réparable en relançant le DELETE, plutôt
        // que des réponses orphelines pointant vers une question disparue.
        await AnswerModel.deleteMany({ questionId: question._id });
        await QuestionModel.deleteOne({ _id: question._id });

        res.status(204).end();
    } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ message: SERVER_ERROR });
    }
}
