import { z } from 'zod';
import { objectId } from './objectId.ts';

const answerFields = z.object({
    body: z
        .string()
        .trim()
        .min(20, 'La réponse doit contenir au moins 20 caractères')
        .max(10_000, 'La réponse ne peut pas dépasser 10000 caractères'),
});

export const createAnswerSchema = answerFields.strict();
export const updateAnswerSchema = answerFields.strict();

export const answerIdParamSchema = z.object({
    id: objectId('Identifiant de réponse invalide'),
});

export const questionIdParamSchema = z.object({
    id: objectId('Identifiant de question invalide'),
});

export const listAnswersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateAnswerInput = z.output<typeof createAnswerSchema>;
export type UpdateAnswerInput = z.output<typeof updateAnswerSchema>;
