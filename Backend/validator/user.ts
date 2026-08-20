import { z } from 'zod';
import { tagSlug } from './tagSlug.ts';

const PASSWORD_RULES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const registerUserSchema = z
    .object({
        email: z
            .string()
            .trim()
            .toLowerCase()
            .pipe(z.email('Email invalide')),
        displayName: z
            .string()
            .trim()
            .min(2, 'Le nom affiché doit contenir au moins 2 caractères')
            .max(50, 'Le nom affiché ne peut pas dépasser 50 caractères'),
        password: z
            .string()
            .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
            .regex(PASSWORD_RULES, 'Le mot de passe doit contenir une minuscule, une majuscule et un chiffre')
            // bcrypt ignore silencieusement tout ce qui dépasse 72 octets.
            .refine((value) => Buffer.byteLength(value) <= 72, 'Le mot de passe ne peut pas dépasser 72 octets'),
        // Une compétence est comparée telle quelle aux slugs de tags par la
        // recherche d'experts : sans normalisation, « React » ne matche jamais
        // « react » et le compte reste invisible, en silence.
        skills: z
            .array(tagSlug('Compétence invalide : attendu un slug de tag, par exemple « node »').pipe(z.string().max(30)))
            .max(20, 'Pas plus de 20 compétences')
            .default([]),
    })
    .strict();

export type RegisterUserInput = z.output<typeof registerUserSchema>;

// Volontairement sans les règles de complexité : elles n'ont de sens qu'à l'inscription,
// et les appliquer ici révélerait la politique de mot de passe à un attaquant.
export const loginUserSchema = z
    .object({
        email: z
            .string()
            .trim()
            .toLowerCase()
            .pipe(z.email('Email invalide')),
        password: z.string().min(1, 'Le mot de passe est obligatoire'),
    })
    .strict();

export type LoginUserInput = z.output<typeof loginUserSchema>;
