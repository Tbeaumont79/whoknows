import express, { type Express } from 'express';
import helmet from 'helmet';
import { connectDatabase } from './config/database.ts';
import { registerUser } from './controller/register.ts';
import { env } from './validator/config/env.ts';

const app: Express = express();
await connectDatabase();

app.use(helmet());
app.use(express.json({ limit: '100kb' }));

app.post('/api/auth/register', registerUser);

app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`)
})
