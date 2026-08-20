import type { Request, Response } from 'express';
import type { PipelineStage, QueryFilter, Types } from 'mongoose';
import { z } from 'zod';
import { tagModel } from '../model/tags.ts';
import { userModel, type User } from '../model/users.ts';
import { listExpertsQuerySchema } from '../validator/expert.ts';

const SERVER_ERROR = 'Erreur interne du serveur';

type ExpertRow = {
    _id: Types.ObjectId;
    displayName: string;
    accepted: number;
    skill: boolean;
};

/**
 * Est « expert » d'un tag celui qui a des réponses acceptées dessus, ou qui
 * le déclare dans ses compétences. Le second cas évite qu'un tag encore neuf
 * ne renvoie personne.
 */
function expertFilter(tag: string): QueryFilter<User> {
    return {
        $or: [
            { 'stats.acceptedByTag': { $elemMatch: { tag, count: { $gt: 0 } } } },
            { skills: tag },
        ],
    };
}

export async function listExperts(req: Request, res: Response): Promise<void> {
    const parsed = listExpertsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        res.status(400).json({ message: 'Paramètres invalides', issues: z.flattenError(parsed.error) });
        return;
    }

    const { tag, page, limit } = parsed.data;

    try {
        // Un tag inconnu est plus probablement une faute de frappe qu'un tag sans
        // expert : mieux vaut le dire que renvoyer une liste vide ambiguë.
        if ((await tagModel.exists({ slug: tag })) === null) {
            res.status(404).json({ message: `Tag inconnu : ${tag}` });
            return;
        }

        const filter = expertFilter(tag);

        // Agrégation obligatoire : on trie sur le compteur d'UN élément précis du
        // tableau `acceptedByTag`, ce qu'un find().sort() ne sait pas exprimer.
        const pipeline: PipelineStage[] = [
            { $match: filter },
            {
                $addFields: {
                    matched: {
                        $filter: {
                            input: { $ifNull: ['$stats.acceptedByTag', []] },
                            as: 'entry',
                            cond: { $eq: ['$$entry.tag', tag] },
                        },
                    },
                },
            },
            {
                $addFields: {
                    accepted: { $ifNull: [{ $arrayElemAt: ['$matched.count', 0] }, 0] },
                    skill: { $in: [tag, { $ifNull: ['$skills', []] }] },
                },
            },
            // Le tri doit être un ordre TOTAL, sinon `$skip`/`$limit` peuvent
            // renvoyer deux fois le même profil et en rendre un autre inatteignable.
            // `displayName` ne suffit pas : il n'est ni unique ni contraint, deux
            // comptes homonymes à égalité de points restent départagés au hasard.
            // `_id` tranche définitivement.
            { $sort: { accepted: -1, displayName: 1, _id: 1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { _id: 1, displayName: 1, accepted: 1, skill: 1 } },
        ];

        const [rows, total] = await Promise.all([
            userModel.aggregate<ExpertRow>(pipeline),
            userModel.countDocuments(filter),
        ]);

        res.status(200).json({
            items: rows.map((row) => ({
                id: row._id.toString(),
                displayName: row.displayName,
                accepted: row.accepted,
                skill: row.skill,
            })),
            tag,
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
