import type { ErrorRequestHandler, RequestHandler } from 'express';

const CLIENT_ERROR_MESSAGES: Record<number, string> = {
    400: 'JSON malformé',
    413: 'Corps de requête trop volumineux',
    415: 'Type de contenu non supporté',
};

/**
 * express.json() rejette avec une erreur portant un `status` (JSON illisible,
 * corps trop gros…). Sans ce tri, le handler par défaut d'Express répond en HTML
 * et casse tout client qui fait `response.json()`.
 */
function clientErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('status' in error)) {
        return undefined;
    }

    const { status } = error;

    return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

export const notFoundHandler: RequestHandler = (req, res) => {
    res.status(404).json({ message: `Route introuvable : ${req.method} ${req.originalUrl}` });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status = clientErrorStatus(error);

    if (status !== undefined) {
        res.status(status).json({ message: CLIENT_ERROR_MESSAGES[status] ?? 'Requête invalide' });
        return;
    }

    console.error(error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
};
