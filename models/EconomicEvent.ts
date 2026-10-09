import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
const schema = new Schema({
  provider: { type: String, required: true }, providerId: { type: String, required: true },
  titleEn: { type: String, required: true }, descriptionEn: { type: String, default: null },
  country: { type: String, required: true }, currency: { type: String, default: '' },
  eventAt: { type: Date, required: true }, timeTentative: { type: Boolean, default: false },
  impact: { type: String, enum: ['high', 'medium', 'low'], required: true },
  actual: { type: String, default: null }, forecast: { type: String, default: null }, previous: { type: String, default: null },
  source: { type: String, required: true }, sourceUrl: { type: String, default: null },
  providerUpdatedAt: { type: Date, default: null }, syncedAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ provider: 1, providerId: 1 }, { unique: true });
schema.index({ provider: 1, eventAt: 1, currency: 1, impact: 1 });
type EventDocument = InferSchemaType<typeof schema>;
export default (mongoose.models.CalendarEvent as Model<EventDocument>) || mongoose.model('CalendarEvent', schema);
