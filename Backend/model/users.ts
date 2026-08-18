import { model, Schema, type InferSchemaType } from 'mongoose';

const acceptedByTagSchema = new Schema({
    tag: { type: String, required: true },
    count: { type: Number, required: true, default: 0, min: 0 }
}, { _id: false });

const userSchema = new Schema({
    email: {
        type: String,
        required: [true, "L'email est obligatoire"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email invalide'],
    },
    displayName: {
        type: String,
        required: true
    },
    passwordHash: {
        type: String,
        required: true,
        select: false,
    },
    skills: {
        type: [String],
        default: []
    },
    stats: {
        acceptedByTag: { type: [acceptedByTagSchema], default: [] }
    }
}, { timestamps: true })

userSchema.index({ skills: 1 });
userSchema.index({ "stats.acceptedByTag.tag": 1 })

export type User = InferSchemaType<typeof userSchema>
export const userModel = model("users", userSchema)
