import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
const schema = new Schema({
  key: { type: String, required: true, unique: true },
  original: { type: String, required: true }, translated: { type: String, required: true },
  locale: { type: String, default: 'km' }, model: { type: String, required: true },
}, { timestamps: true });
type TranslationDocument = InferSchemaType<typeof schema>;
export default (mongoose.models.Translation as Model<TranslationDocument>) || mongoose.model('Translation', schema);
