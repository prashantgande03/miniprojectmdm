import { cropFactors, cropStandards } from './data.js';

export function getCropStandard(crop) { return cropStandards[crop] || cropStandards.default; }

export function fallbackPrediction({ weather, area }) {
  const demand = (weather.et0 * (cropFactors[area.crop] || 1)) + (100 - weather.soilMoisture) / 35;
  const label = demand > 6.5 ? 'High irrigation need' : demand > 3.8 ? 'Medium irrigation need' : 'Low irrigation need';
  return { prediction: label, confidence: Math.min(0.97, Math.round((0.6 + Math.abs(demand - 4.5) / 12) * 100) / 100), source: 'fallback heuristic' };
}

export async function getMlPrediction(area, weather) {
  try {
    const response = await fetch(`${process.env.ML_SERVICE_URL || 'http://localhost:8000'}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ temperature: weather.temperature, humidity: weather.humidity, rainfall: weather.rainfall, rain_probability: weather.rainProbability, soil_moisture: weather.soilMoisture, et0: weather.et0, crop: area.crop, growth_stage: area.growthStage, farm_size: area.farmSize }) });
    if (!response.ok) throw new Error('ML API unavailable');
    return await response.json();
  } catch { return fallbackPrediction({ weather, area }); }
}

export function makeDecision(weather, prediction, area = {}) {
  const soilThresholds = { 'Sandy loam': 25, 'Loamy soil': 30, 'Medium black soil': 38, 'Black cotton soil': 42, 'Deep black soil': 42 };
  const sufficientMoisture = soilThresholds[area.soilType] || 35;
  if (weather.rainProbability >= 60) return { finalDecision: "DON'T IRRIGATE", reason: `High rain probability (${weather.rainProbability}%) means natural rainfall is expected.` };
  if (weather.soilMoisture >= sufficientMoisture) return { finalDecision: "DON'T IRRIGATE", reason: `Modeled soil moisture is sufficient for ${area.soilType || 'this soil'} at ${weather.soilMoisture}% (field threshold ${sufficientMoisture}%).` };
  if (prediction.prediction === 'High irrigation need') return { finalDecision: 'IRRIGATE', reason: `ML indicates high need, while soil moisture is low (${weather.soilMoisture}%) and rain probability is ${weather.rainProbability}%.` };
  if (prediction.prediction === 'Medium irrigation need') return { finalDecision: 'WAIT / MONITOR', reason: `ML indicates medium need. Monitor modeled soil moisture before the next review.` };
  return { finalDecision: "DON'T IRRIGATE", reason: 'ML indicates low irrigation need under the current weather conditions.' };
}
