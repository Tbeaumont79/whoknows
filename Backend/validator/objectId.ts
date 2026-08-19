import { z } from 'zod';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** Un id Mongo mal formé fait lever un CastError à Mongoose : on le filtre avant. */
export function objectId(message: string) {
    return z.string().regex(OBJECT_ID, message);
}
