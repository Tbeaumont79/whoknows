import { Schema } from 'mongoose';

export const authorSnapshotSchema = new Schema(
    {
        _id: { type: Schema.Types.ObjectId, ref: "users", required: true },
        displayName: { type: String, required: true },
    },
    { _id: false }
);
