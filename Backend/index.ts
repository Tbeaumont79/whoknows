import express, { type Express } from 'express';
import helmet from 'helmet';
import { connectDatabase } from './config/database.ts';
import { env } from './validator/config/env.ts';

const app: Express = express();
await connectDatabase();

app.use(helmet());

app.listen(env.PORT, async () => {
    console.log(`Server is running on port ${env.PORT}`)
})
