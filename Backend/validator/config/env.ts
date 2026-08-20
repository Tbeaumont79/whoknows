import {z} from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
    // Nombre de proxies de confiance devant l'app (0 = accès direct, 1 = un reverse
    // proxy). Sert au rate limit à lire la vraie IP cliente dans X-Forwarded-For.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    MONGODB_URI: z.string().url().startsWith('mongodb'),
    MONGODB_DB_NAME: z.string().min(1).default('whoknows'),
    MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).default(20),
    JWT_SECRET: z.string().min(32),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
    console.error('✘ Variables d\'environnement invalides :');
    console.error(z.prettifyError(parsed.error));
    process.exit(1);
}

export const env = Object.freeze(parsed.data);
