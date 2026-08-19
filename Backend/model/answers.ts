import { Schema, model } from 'mongoose';
import { authorSnapshotSchema } from './authorSnapshot.ts';

const answerSchema = new Schema(
    {
        questionId: { type: Schema.Types.ObjectId, ref: "questions", required: true },
        body: { type: String, required: true, maxlength: 10000 },
        author: { type: authorSnapshotSchema, required: true },
    },
    { timestamps: true }
);

answerSchema.index({ questionId: 1, createdAt: 1 });
answerSchema.index({ "author._id": 1 });

export const AnswerModel = model("answers", answerSchema);
