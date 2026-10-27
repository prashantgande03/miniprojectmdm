import mongoose from 'mongoose';

const { Schema } = mongoose;

// Login/profile data. passwordHash is never returned by the API.
const farmerSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 40 },
  passwordHash: { type: String, required: true, select: false },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  village: { type: String, required: true, trim: true, maxlength: 80 },
  taluka: { type: String, required: true, trim: true, maxlength: 80 },
  district: { type: String, required: true, trim: true, maxlength: 80 }
}, { timestamps: true, versionKey: false });

// Crop and field parameters used to calculate an irrigation schedule.
const areaSchema = new Schema({
  farmerId: { type: Schema.Types.ObjectId, ref: 'Farmer', required: true, index: true },
  areaName: { type: String, required: true, trim: true, maxlength: 100 },
  village: { type: String, required: true, trim: true }, taluka: { type: String, required: true, trim: true }, district: { type: String, required: true, trim: true },
  latitude: { type: Number, required: true, min: -90, max: 90 }, longitude: { type: Number, required: true, min: -180, max: 180 },
  crop: { type: String, required: true, trim: true, maxlength: 60 }, sowingDate: { type: String, required: true },
  farmSize: { type: Number, required: true, min: 0.01 }, soilType: { type: String, required: true, trim: true }, growthStage: { type: String, trim: true }
}, { timestamps: true, versionKey: false });
areaSchema.index({ farmerId: 1, areaName: 1 });

const scheduleSchema = new Schema({ farmerId: { type: Schema.Types.ObjectId, ref: 'Farmer', required: true, index: true }, areaId: { type: Schema.Types.ObjectId, ref: 'Area', required: true, index: true }, areaName: String, village: String, crop: String, date: { type: String, required: true }, time: String, duration: { type: Number, min: 0 }, mlPrediction: String, confidence: Number, finalDecision: String, reason: String, status: { type: String, default: 'Planned' }, planType: { type: String, default: 'recommendation' } }, { timestamps: true, versionKey: false });
scheduleSchema.index({ areaId: 1, date: 1 }, { unique: true });

const irrigationEventSchema = new Schema({ farmerId: { type: Schema.Types.ObjectId, ref: 'Farmer', required: true, index: true }, farmerName: String, areaId: { type: Schema.Types.ObjectId, ref: 'Area', required: true }, fieldName: String, village: String, taluka: String, district: String, crop: String, date: { type: String, required: true }, time: String, duration: { type: Number, min: 0 }, waterSource: { type: String, default: 'Not specified' }, notes: { type: String, maxlength: 500 } }, { timestamps: true, versionKey: false });
const alertSchema = new Schema({ areaId: { type: Schema.Types.ObjectId, ref: 'Area', required: true }, title: String, message: String, type: String, read: { type: Boolean, default: false } }, { timestamps: true, versionKey: false });

export const Area = mongoose.model('Area', areaSchema);
export const Farmer = mongoose.model('Farmer', farmerSchema);
export const IrrigationSchedule = mongoose.model('IrrigationSchedule', scheduleSchema);
export const IrrigationEvent = mongoose.model('IrrigationEvent', irrigationEventSchema);
export const Alert = mongoose.model('Alert', alertSchema);
