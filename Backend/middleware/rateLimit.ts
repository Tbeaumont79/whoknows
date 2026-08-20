import rateLimit from 'express-rate-limit';

const MINUTE = 60 * 1000;

/**
 * Le login est la route la plus coûteuse du serveur : bcrypt y brûle ~270 ms de
 * CPU par appel, y compris quand l'email n'existe pas (comparaison contre un hash
 * factice, pour ne pas laisser le temps de réponse révéler les comptes). Sans
 * limite, quelques centaines de requêtes suffisent à saturer le processus.
 *
 * `skipSuccessfulRequests` : seuls les échecs consomment le budget, un utilisateur
 * légitime qui se connecte plusieurs fois d'affilée n'est jamais bloqué.
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Trop de tentatives de connexion, réessayez dans quelques minutes' },
});

/** Ici c'est le succès qui pose problème : on limite la création de comptes en masse. */
export const registerLimiter = rateLimit({
    windowMs: 60 * MINUTE,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Trop de comptes créés depuis cette adresse, réessayez plus tard' },
});
