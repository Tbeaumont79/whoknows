import { Schema, model } from "mongoose"


const tagSchema = new Schema({
    slug: {
        type: String,
        required: true,
        unique: true
    },
    label: {
        type: String,
        required: true
    },
    description: {
        type: String
    }
});

export const tagModel = model("tags", tagSchema);
