import { z } from 'zod';
import { tagSlug } from './tagSlug.ts';

export const listExpertsQuerySchema = z.object({
    // Obligatoire ici, contrairement à la liste des questions : « les experts »
    // sans tag ne veut rien dire.
    tag: tagSlug('Slug de tag invalide'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListExpertsQuery = z.output<typeof listExpertsQuerySchema>;
