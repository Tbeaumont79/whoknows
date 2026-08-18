import mongoose from 'mongoose';
import { env } from '../validator/config/env.ts';

mongoose.set('strictQuery', 'throw');

export async function connectDatabase(): Promise<typeof mongoose> {
    const conn = await mongoose.connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB_NAME,
        maxIdleTimeMS: 30_000,
        serverSelectionTimeoutMS: 5_000,
        socketTimeoutMS: 45_000,
        connectTimeoutMS: 10_000,
    })

    return conn;
}
