import { z } from 'zod';

const TAG_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Slug de tag, normalisé avant validation. Partagé entre les tags d'une question,
 * les compétences d'un utilisateur et la recherche d'experts : ces trois valeurs
 * sont comparées entre elles, la moindre divergence de forme casse le rapprochement.
 */
export function tagSlug(message: string) {
    return z.string().trim().toLowerCase().pipe(z.string().regex(TAG_SLUG, message));
}
