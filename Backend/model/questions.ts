import { Schema, model } from "mongoose";
import { authorSnapshotSchema } from "./authorSnapshot.ts";

const questionSchema = new Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 160 },
        body: { type: String, required: true, maxlength: 10000 },

        tags: {
            type: [String],
            required: true,
            validate: [(v: string[]) => v.length >= 1 && v.length <= 3, "1 à 3 tags"],
        },

        status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
        author: { type: authorSnapshotSchema, required: true },

        acceptedAnswerId: { type: Schema.Types.ObjectId, ref: "answers", default: null },
        answerCount: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);

questionSchema.index({ tags: 1, createdAt: -1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ "author._id": 1 });
questionSchema.index(
    { title: "text", body: "text" },
    { weights: { title: 3, body: 1 }, default_language: "french", name: "question_text" }
);

export const QuestionModel = model("questions", questionSchema);
