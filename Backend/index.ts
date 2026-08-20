import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { connectDatabase } from './config/database.ts';
import { acceptAnswer } from './controller/accept.ts';
import { createAnswer, deleteAnswer, listAnswers, updateAnswer } from './controller/answer.ts';
import { listExperts } from './controller/expert.ts';
import { loginUser } from './controller/login.ts';
import { getMe } from './controller/me.ts';
import {
    createQuestion,
    deleteQuestion,
    getQuestion,
    listQuestions,
    updateQuestion,
} from './controller/question.ts';
import { registerUser } from './controller/register.ts';
import { requireAuth } from './middleware/auth.ts';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import { env } from './validator/config/env.ts';

const app: Express = express();
await connectDatabase();

app.use(helmet());
// `credentials` est indispensable : sans lui le navigateur ignore le cookie de session.
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);
app.get('/api/auth/me', requireAuth, getMe);

app.get('/api/questions', listQuestions);
app.get('/api/questions/:id', getQuestion);
app.post('/api/questions', requireAuth, createQuestion);
app.patch('/api/questions/:id', requireAuth, updateQuestion);
app.delete('/api/questions/:id', requireAuth, deleteQuestion);

app.get('/api/questions/:id/answers', listAnswers);
app.post('/api/questions/:id/answers', requireAuth, createAnswer);
app.patch('/api/answers/:id', requireAuth, updateAnswer);
app.delete('/api/answers/:id', requireAuth, deleteAnswer);

app.post('/api/questions/:id/accept', requireAuth, acceptAnswer);

app.get('/api/experts', listExperts);

// Toujours en dernier : le catch-all 404 puis le handler d'erreur.
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`)
})
