import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { demoAreas } from './data.js';
import { Area, Alert, Farmer, IrrigationEvent, IrrigationSchedule } from './models.js';
import { getWeather } from './weather.js';
import { getCropStandard, getMlPrediction, makeDecision } from './decision.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverDirectory, '../.env') });
dotenv.config({ path: path.join(serverDirectory, '.env') });
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;
let databaseReady = false;
let memoryFarmers = [{ _id: 'demo-farmer', username: 'demo', passwordHash: createHash('sha256').update('demo123').digest('hex'), name: 'Demo Farmer', village: 'Waluj', taluka: 'Gangapur', district: 'Chhatrapati Sambhajinagar' }];
let memoryAreas = demoAreas.map((area, index) => ({ ...area, _id: `demo-${index + 1}` }));
let memorySchedules = [];
let memoryAlerts = [];
let memoryIrrigationEvents = [];
const storageFile = path.join(serverDirectory, 'storage.json');

async function saveStorage() {
  await writeFile(storageFile, JSON.stringify({ farmers: memoryFarmers, areas: memoryAreas, schedules: memorySchedules, alerts: memoryAlerts, irrigationEvents: memoryIrrigationEvents }, null, 2));
}
async function connectDatabase() {
  if (process.env.USE_JSON_STORAGE === 'true' || !process.env.MONGODB_URI) {
    console.warn('MongoDB URI is not configured. Using local server/storage.json.');
    const stored = JSON.parse(await readFile(storageFile, 'utf8'));
    if (stored.farmers?.length) memoryFarmers = stored.farmers;
    if (stored.areas?.length) memoryAreas = stored.areas;
    if (stored.schedules?.length) memorySchedules = stored.schedules;
    if (stored.alerts?.length) memoryAlerts = stored.alerts;
    if (stored.irrigationEvents?.length) memoryIrrigationEvents = stored.irrigationEvents;
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  databaseReady = true;
  await Promise.all([Farmer.init(), Area.init(), IrrigationSchedule.init(), IrrigationEvent.init(), Alert.init()]);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
async function listAreas(farmerId) { return databaseReady ? Area.find(farmerId ? { farmerId } : {}).sort({ village: 1, areaName: 1 }) : memoryAreas.filter((area) => !farmerId || area.farmerId === farmerId); }
async function findArea(id) { return databaseReady ? Area.findById(id) : memoryAreas.find((area) => area._id === id); }
function hashPassword(password) { return createHash('sha256').update(password).digest('hex'); }
function publicFarmer(farmer) { const value = farmer.toObject ? farmer.toObject() : { ...farmer }; delete value.passwordHash; return value; }
function cropAgeDays(sowingDate) { return sowingDate ? Math.max(0, Math.floor((Date.now() - new Date(sowingDate).getTime()) / 86400000)) : null; }
function stageForAge(days) { if (days === null) return 'Not specified'; if (days < 20) return 'Sowing'; if (days < 55) return 'Vegetative'; if (days < 100) return 'Flowering'; return 'Maturity / harvest'; }
async function lastIrrigation(areaId) { return databaseReady ? IrrigationEvent.findOne({ areaId }).sort({ date: -1, createdAt: -1 }) : memoryIrrigationEvents.filter((event) => event.areaId === areaId).sort((a, b) => b.date.localeCompare(a.date))[0]; }
function dateKey(date) { return new Date(date).toISOString().slice(0, 10); }
function addDays(date, days) { const value = new Date(`${dateKey(date)}T12:00:00`); value.setDate(value.getDate() + days); return dateKey(value); }
function scheduleId(areaId, date) { return `plan-${areaId}-${date}`; }
async function upsertSchedule(schedule) {
  if (databaseReady) return IrrigationSchedule.findOneAndUpdate({ areaId: schedule.areaId, date: schedule.date }, schedule, { upsert: true, new: true, setDefaultsOnInsert: true });
  const existing = memorySchedules.find((item) => item.areaId === schedule.areaId && item.date === schedule.date);
  if (existing) Object.assign(existing, schedule);
  else memorySchedules.push({ ...schedule, _id: scheduleId(schedule.areaId, schedule.date) });
  return schedule;
}
async function schedulesForFarmer(farmerId) {
  if (databaseReady) {
    const areaIds = (await Area.find({ farmerId }).select('_id')).map((area) => String(area._id));
    return IrrigationSchedule.find({ areaId: { $in: areaIds } });
  }
  const areaIds = new Set(memoryAreas.filter((area) => area.farmerId === farmerId).map((area) => area._id));
  return memorySchedules.filter((schedule) => areaIds.has(schedule.areaId));
}
async function addAlert(areaId, areaName, decision) {
  const alert = { areaId, title: `${areaName} area`, message: decision.message, type: decision.finalDecision === 'IRRIGATE' ? 'danger' : decision.finalDecision === 'WAIT / MONITOR' ? 'warning' : 'success', read: false, createdAt: new Date() };
  if (databaseReady) return Alert.findOneAndUpdate({ areaId }, alert, { upsert: true, new: true, setDefaultsOnInsert: true });
  const existing = memoryAlerts.find((item) => item.areaId === areaId);
  if (existing) Object.assign(existing, alert);
  else memoryAlerts.unshift({ ...alert, _id: `alert-${Date.now()}` });
  return alert;
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', database: databaseReady ? 'mongodb' : 'json-file', persistence: databaseReady ? mongoose.connection.name : 'server/storage.json' }));
app.post('/api/farmers/signin', async (req, res) => {
  const { username, password, name, village, taluka, district } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
  const normalizedUsername = username.trim().toLowerCase();
  if (databaseReady) {
    let farmer = await Farmer.findOne({ username: normalizedUsername }).select('+passwordHash');
    if (farmer && farmer.passwordHash !== hashPassword(password)) return res.status(401).json({ message: 'Incorrect username or password.' });
    if (!farmer && (!name || !village || !taluka || !district)) return res.status(400).json({ message: 'New farmers must provide name, village, taluka and district.' });
    farmer = farmer || await Farmer.create({ username: normalizedUsername, passwordHash: hashPassword(password), name, village, taluka, district });
    return res.json(publicFarmer(farmer));
  }
  let farmer = memoryFarmers.find((item) => item.username === normalizedUsername);
  if (farmer && farmer.passwordHash !== hashPassword(password)) return res.status(401).json({ message: 'Incorrect username or password.' });
  if (!farmer && (!name || !village || !taluka || !district)) return res.status(400).json({ message: 'New farmers must provide name, village, taluka and district.' });
  if (!farmer) { farmer = { _id: `farmer-${Date.now()}`, username: normalizedUsername, passwordHash: hashPassword(password), name, village, taluka, district }; memoryFarmers.push(farmer); }
  await saveStorage(); res.json(publicFarmer(farmer));
});
app.get('/api/areas', async (req, res) => res.json(await listAreas(req.query.farmerId)));
app.post('/api/areas', async (req, res) => {
  const { farmerId, areaName, village, taluka, district, latitude, longitude, crop, sowingDate, farmSize, soilType, growthStage } = req.body;
  if (!farmerId || !village || !taluka || !district || !latitude || !longitude || !crop || !sowingDate) return res.status(400).json({ message: 'Farmer, village, taluka, district, coordinates, crop and sowing date are required.' });
  const areaData = { farmerId, areaName: areaName || village, village, taluka, district, latitude: Number(latitude), longitude: Number(longitude), crop, sowingDate, farmSize: Number(farmSize || 0), soilType: soilType || 'Not specified', growthStage: growthStage || stageForAge(cropAgeDays(sowingDate)) };
  const area = databaseReady ? await Area.create(areaData) : { _id: `demo-${Date.now()}`, ...areaData };
  if (!databaseReady) { memoryAreas.push(area); await saveStorage(); }
  res.status(201).json(area);
});
app.get('/api/areas/:id', async (req, res) => { const area = await findArea(req.params.id); area ? res.json(area) : res.status(404).json({ message: 'Area not found.' }); });
app.delete('/api/areas/:id', async (req, res) => { if (databaseReady) await Area.findByIdAndDelete(req.params.id); else memoryAreas = memoryAreas.filter((area) => area._id !== req.params.id); res.json({ message: 'Area deleted.' }); });
app.get('/api/irrigation/history/:areaId', async (req, res) => res.json(databaseReady ? await IrrigationEvent.find({ areaId: req.params.areaId }).sort({ date: -1 }).limit(30) : memoryIrrigationEvents.filter((event) => event.areaId === req.params.areaId).sort((a, b) => b.date.localeCompare(a.date))));
app.post('/api/irrigation/log/:areaId', async (req, res) => {
  const area = await findArea(req.params.areaId); if (!area) return res.status(404).json({ message: 'Area not found.' });
  const farmer = databaseReady ? await Farmer.findById(area.farmerId) : memoryFarmers.find((item) => item._id === area.farmerId);
  const event = { farmerId: area.farmerId, farmerName: farmer?.name, areaId: area._id, fieldName: area.areaName, village: area.village, taluka: area.taluka, district: area.district, crop: area.crop, date: req.body.date || new Date().toISOString().slice(0, 10), time: req.body.time || new Date().toTimeString().slice(0, 5), duration: Number(req.body.duration || 0), durationUnit: req.body.durationUnit || 'hours', waterSource: req.body.waterSource || 'Not specified', notes: req.body.notes || '' };
  const saved = databaseReady ? await IrrigationEvent.create(event) : { ...event, _id: `irrigation-${Date.now()}` }; if (!databaseReady) { memoryIrrigationEvents.unshift(saved); await saveStorage(); } res.status(201).json(saved);
});

async function analyzeArea(area) {
  const currentArea = { ...area, growthStage: stageForAge(cropAgeDays(area.sowingDate)) };
  const weather = await getWeather(area.latitude, area.longitude);
  const prediction = await getMlPrediction(currentArea, weather);
  const decision = makeDecision(weather, prediction, currentArea);
  const standard = getCropStandard(currentArea.crop); const last = await lastIrrigation(area._id); const todayDate = new Date();
  const lastDate = last ? new Date(last.date) : null; const daysSince = lastDate ? Math.floor((todayDate - lastDate) / 86400000) : null;
  const rainDay = (weather.forecast || []).slice(0, 4).find((day) => day.rainProbability >= 60);
  let recommendedDate = new Date(todayDate); let timing = 'tomorrow';
  if (rainDay) { recommendedDate = new Date(`${rainDay.date}T06:00:00`); timing = `after expected rain on ${rainDay.date}`; }
  else if (daysSince !== null && daysSince < standard.intervalDays) { recommendedDate.setDate(todayDate.getDate() + (standard.intervalDays - daysSince)); timing = `in ${standard.intervalDays - daysSince} days`; }
  else if (decision.finalDecision !== 'IRRIGATE') { recommendedDate.setDate(todayDate.getDate() + 7); timing = 'next week'; }
  else recommendedDate.setDate(todayDate.getDate() + 1);
  const recommendedDateText = recommendedDate.toISOString().slice(0, 10);
  if (decision.finalDecision === 'IRRIGATE') decision.message = `Irrigation recommended ${timing} at 06:00 for ${currentArea.village}.`;
  else decision.message = `${decision.reason} Schedule review ${timing} (${recommendedDateText}).`;
  decision.reason += ` Crop standard: ${standard.label}; ${standard.hoursPerAcre} hours per acre. ${last ? `Last irrigation was ${last.date}${daysSince === 0 ? ' today' : `, ${daysSince} days ago`}.` : 'No previous irrigation record yet.'}`;
  const schedule = { farmerId: area.farmerId, areaId: area._id, areaName: area.areaName, village: area.village, crop: area.crop, sowingDate: area.sowingDate, date: recommendedDateText, time: decision.finalDecision === 'IRRIGATE' ? '06:00' : 'Review 18:00', duration: decision.finalDecision === 'IRRIGATE' ? Number((area.farmSize * standard.hoursPerAcre).toFixed(1)) : 0, durationUnit: 'hours', hoursPerAcre: standard.hoursPerAcre, mlPrediction: prediction.prediction, confidence: prediction.confidence, finalDecision: decision.finalDecision, reason: decision.reason, status: decision.finalDecision === 'IRRIGATE' ? 'Planned' : 'Monitor', planType: 'recommendation' };
  await upsertSchedule(schedule);
  await addAlert(area._id, area.areaName, decision); if (!databaseReady) await saveStorage();
  return { area: currentArea, weather, prediction, decision, schedule, lastIrrigation: last || null };
}
app.get('/api/weather/:areaId', async (req, res) => { try { const area = await findArea(req.params.areaId); if (!area) return res.status(404).json({ message: 'Area not found.' }); res.json(await getWeather(area.latitude, area.longitude)); } catch (error) { res.status(502).json({ message: error.message }); } });
app.get('/api/weather/:areaId/forecast', async (req, res) => { try { const area = await findArea(req.params.areaId); res.json((await getWeather(area.latitude, area.longitude)).forecast); } catch (error) { res.status(502).json({ message: error.message }); } });
app.post('/api/irrigation/analyze/:areaId', async (req, res) => { try { const area = await findArea(req.params.areaId); if (!area) return res.status(404).json({ message: 'Area not found.' }); res.json(await analyzeArea(area)); } catch (error) { res.status(502).json({ message: error.message }); } });
app.get('/api/irrigation/schedules', async (req, res) => {
  const { farmerId, days = 30 } = req.query;
  if (!farmerId) return res.status(400).json({ message: 'farmerId is required.' });
  const horizon = Math.min(Math.max(Number(days) || 30, 1), 90);
  const today = dateKey(new Date()); const until = addDays(today, horizon - 1);
  const areas = await listAreas(farmerId);
  let saved = await schedulesForFarmer(farmerId);
  const plans = [];
  for (const area of areas) {
    const standard = getCropStandard(area.crop);
    const areaSchedules = saved.filter((item) => item.areaId === area._id).sort((a, b) => a.date.localeCompare(b.date));
    const base = areaSchedules.find((item) => item.date >= today) || areaSchedules[areaSchedules.length - 1];
    if (!base) continue;
    let nextDate = base.date < today ? addDays(base.date, Math.ceil((new Date(`${today}T12:00:00`) - new Date(`${base.date}T12:00:00`)) / 86400000 / standard.intervalDays) * standard.intervalDays) : base.date;
    while (nextDate <= until) {
      const planned = nextDate === base.date ? base : { ...base, date: nextDate, time: '06:00', duration: Number((area.farmSize * standard.hoursPerAcre).toFixed(1)), durationUnit: 'hours', hoursPerAcre: standard.hoursPerAcre, finalDecision: 'IRRIGATE', status: 'Planned', planType: 'forecast', reason: `Routine ${standard.label}. This future plan is based on your crop, field size, and latest recommendation.` };
      plans.push(planned);
      if (nextDate !== base.date) await upsertSchedule(planned);
      nextDate = addDays(nextDate, standard.intervalDays);
    }
  }
  if (!databaseReady) await saveStorage();
  res.json(plans.sort((a, b) => a.date.localeCompare(b.date) || a.areaName.localeCompare(b.areaName)));
});
app.get('/api/irrigation/history', async (req, res) => {
  const { farmerId } = req.query;
  if (!farmerId) return res.status(400).json({ message: 'farmerId is required.' });
  const events = databaseReady ? await IrrigationEvent.find({ farmerId }).sort({ date: -1, createdAt: -1 }).limit(50) : memoryIrrigationEvents.filter((item) => item.farmerId === farmerId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
  res.json(events);
});
app.get('/api/alerts', async (req, res) => res.json(databaseReady ? await Alert.find().sort({ createdAt: -1 }).limit(30) : memoryAlerts));
app.put('/api/alerts/:id/read', async (req, res) => { if (databaseReady) await Alert.findByIdAndUpdate(req.params.id, { read: true }); else { const alert = memoryAlerts.find((item) => item._id === req.params.id); if (alert) alert.read = true; } res.json({ read: true }); });

connectDatabase().then(() => app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`))).catch((error) => {
  console.error(`Unable to start server: ${error.message}`);
  process.exit(1);
});
