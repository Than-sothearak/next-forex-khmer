import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
const schema = new Schema({
  _id: { type: String, required: true },
  lockUntil: { type: Date, default: new Date(0) }, lockToken: String,
  nextAttemptAt: { type: Date, default: new Date(0) },
  translationLockUntil: Date, translationLockToken: String, translationNextAttemptAt: Date,
  lastSuccess: Date, coverageFrom: Date, coverageTo: Date,
  lastError: { type: String, default: null },
  translationPending: { type: Boolean, default: false },
});
type SyncDocument = InferSchemaType<typeof schema>;
export default (mongoose.models.CalendarSync as Model<SyncDocument>) || mongoose.model('CalendarSync', schema);
