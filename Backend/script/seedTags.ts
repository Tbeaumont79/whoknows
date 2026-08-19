import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.ts';
import { tagModel } from '../model/tags.ts';

const TAGS = [
    { slug: 'javascript', label: 'JavaScript', description: 'Le langage du web, côté client comme serveur.' },
    { slug: 'typescript', label: 'TypeScript', description: 'JavaScript typé statiquement.' },
    { slug: 'node', label: 'Node.js', description: "L'exécution de JavaScript côté serveur." },
    { slug: 'express', label: 'Express', description: 'Framework HTTP minimaliste pour Node.js.' },
    { slug: 'mongodb', label: 'MongoDB', description: 'Base de données orientée documents.' },
    { slug: 'mongoose', label: 'Mongoose', description: 'ODM MongoDB pour Node.js.' },
    { slug: 'react', label: 'React', description: "Bibliothèque d'interfaces utilisateur." },
    { slug: 'css', label: 'CSS', description: 'Mise en forme des documents web.' },
    { slug: 'git', label: 'Git', description: 'Gestion de versions décentralisée.' },
    { slug: 'docker', label: 'Docker', description: 'Conteneurisation des applications.' },
];

await connectDatabase();

// Idempotent : relancer le script ne crée pas de doublon et rafraîchit les libellés.
const result = await tagModel.bulkWrite(
    TAGS.map((tag) => ({
        updateOne: { filter: { slug: tag.slug }, update: { $set: tag }, upsert: true },
    })),
);

console.log(`tags créés : ${result.upsertedCount}, mis à jour : ${result.modifiedCount}`);
console.log(`total en base : ${await tagModel.countDocuments()}`);

await mongoose.disconnect();
