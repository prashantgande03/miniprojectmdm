import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Area, Farmer } from './models.js';
import { demoAreas } from './data.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverDirectory, '../.env') });
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required to seed MongoDB.');

await mongoose.connect(process.env.MONGODB_URI);
const demoFarmer = await Farmer.findOneAndUpdate(
  { username: 'demo' },
  { $setOnInsert: { username: 'demo', passwordHash: createHash('sha256').update('demo123').digest('hex'), name: 'Demo Farmer', village: 'Waluj', taluka: 'Gangapur', district: 'Chhatrapati Sambhajinagar' } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
await Area.deleteMany({ farmerId: demoFarmer._id });
await Area.insertMany(demoAreas.map(({ farmerId, ...area }) => ({ ...area, farmerId: demoFarmer._id })));
console.log('Seeded five demo crop fields for login demo / demo123.');
await mongoose.disconnect();
