import mongoose, { Schema } from 'mongoose';
const NewsSchema = new Schema({
  title: { type: String, required: true }, slug: { type: String, required: true, unique: true },
  summary: { type: String, required: true }, body: { type: String, required: true },
  titleEn: String, summaryEn: String, bodyEn: String, source: String,
  sourceUrl: String, marketImpactKm: String,
  category: { type: String, default: 'Market' }, impact: { type: String, enum: ['high','medium','low'], default: 'medium' },
  publishedAt: { type: Date, default: Date.now }, status: { type: String, enum: ['draft','published'], default: 'published' },
}, { timestamps: true });
export default mongoose.models.News || mongoose.model('News', NewsSchema);
