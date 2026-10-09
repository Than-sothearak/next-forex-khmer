import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const schema = new Schema({
  key: { type: String, required: true, unique: true },
  provider: { type: String, required: true },
  providerId: { type: String, required: true },
  titleEn: { type: String, required: true },
  titleKm: { type: String, default: null },
  eventDetails: { type: String, default: null },
  currency: { type: String, required: true },
  country: { type: String, required: true },
  impact: { type: String, enum: ['high', 'medium', 'low'], required: true },
  eventDateKm: { type: String, required: true },
  actual: { type: String, default: null },
  forecast: { type: String, default: null },
  previous: { type: String, default: null },
  eventNameKm: { type: String, default: null },
  overviewKm: { type: String, default: null },
  valuesExplanationKm: { type: String, default: null },
  marketScenarios: { type: [{ scenarioKm: String, usdKm: String, goldKm: String, otherCurrenciesKm: String }], default: [] },
  summaryHigherKm: { type: String, default: null },
  summaryLowerKm: { type: String, default: null },
  summaryWatchKm: { type: String, default: null },
  reminderKm: { type: String, default: null },
  model: { type: String, default: null },
  lockToken: { type: String, default: null },
  lockUntil: { type: Date, default: () => new Date(0) },
  retryAfter: { type: Date, default: () => new Date(0) },
}, { timestamps: true });

type CalendarInsightDocument = InferSchemaType<typeof schema>;
export default (mongoose.models.CalendarInsight as Model<CalendarInsightDocument>) || mongoose.model('CalendarInsight', schema);
