import { z } from 'zod';
import { objectId } from './objectId.ts';
import { tagSlug } from './tagSlug.ts';

const questionFields = z.object({
    title: z
        .string()
        .trim()
        .min(10, 'Le titre doit contenir au moins 10 caractères')
        .max(160, 'Le titre ne peut pas dépasser 160 caractères'),
    body: z
        .string()
        .trim()
        .min(20, 'La question doit contenir au moins 20 caractères')
        .max(10_000, 'La question ne peut pas dépasser 10000 caractères'),
    tags: z
        .array(tagSlug('Slug de tag invalide'))
        .min(1, 'Il faut entre 1 et 3 tags')
        .max(3, 'Il faut entre 1 et 3 tags')
        .refine((tags) => new Set(tags).size === tags.length, 'Tags en doublon'),
});

export const createQuestionSchema = questionFields.strict();

export const updateQuestionSchema = questionFields
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'Aucun champ à modifier');

// Pas de `.strict()` ici : une query string traîne souvent des paramètres parasites
// (utm_source…) et les rejeter en 400 casserait des liens pour rien. Zod les ignore.
export const listQuestionsQuerySchema = z.object({
    tag: tagSlug('Slug de tag invalide').optional(),
    status: z.enum(['open', 'resolved']).optional(),
    q: z.string().trim().min(2, 'Recherche trop courte').max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const questionIdParamSchema = z.object({
    id: objectId('Identifiant de question invalide'),
});

export const acceptAnswerSchema = z
    .object({
        answerId: objectId('Identifiant de réponse invalide'),
    })
    .strict();

export type CreateQuestionInput = z.output<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.output<typeof updateQuestionSchema>;
export type ListQuestionsQuery = z.output<typeof listQuestionsQuerySchema>;
