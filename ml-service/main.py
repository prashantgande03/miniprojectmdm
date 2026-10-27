import pickle
from pathlib import Path

import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title='Climate-Aware Precision Irrigation Model')
MODEL_DIR = Path(__file__).parent / 'models'
MODEL_PATH = MODEL_DIR / 'decision_tree_model.pkl'
ARTIFACT_PATH = MODEL_DIR / 'preprocessing_artifacts.pkl'
model = None
artifacts = None

if MODEL_PATH.exists() and ARTIFACT_PATH.exists():
    with MODEL_PATH.open('rb') as file:
        model = pickle.load(file)
    with ARTIFACT_PATH.open('rb') as file:
        artifacts = pickle.load(file)

class Features(BaseModel):
    temperature: float
    humidity: float
    rainfall: float = 0
    rain_probability: float
    soil_moisture: float
    et0: float
    crop: str
    growth_stage: str
    farm_size: float = 1.0

@app.get('/health')
def health():
    return {'status': 'ok', 'model': 'upstream decision tree', 'artifacts_loaded': model is not None}


def upstream_features(features: Features) -> pd.DataFrame:
    # These defaults are explicit because Open-Meteo cannot provide soil lab or farm-management fields.
    row = {
        'Soil_Type': 'Loamy', 'Soil_pH': 7.0, 'Soil_Moisture': features.soil_moisture,
        'Organic_Carbon': 0.5, 'Electrical_Conductivity': 1.0, 'Temperature_C': features.temperature,
        'Humidity': features.humidity, 'Rainfall_mm': features.rainfall, 'Sunlight_Hours': 8.0,
        'Wind_Speed_kmh': 10.0, 'Crop_Type': features.crop, 'Crop_Growth_Stage': features.growth_stage,
        'Season': 'Kharif' if features.rain_probability >= 50 else 'Rabi', 'Irrigation_Type': 'Drip',
        'Water_Source': 'Groundwater', 'Field_Area_hectare': features.farm_size * 0.404686, 'Mulching_Used': 'No',
        'Previous_Irrigation_mm': 0.0, 'Region': 'Central'
    }
    frame = pd.DataFrame([row])
    encoders = (artifacts or {}).get('encoders', {})
    for column, encoder in encoders.items():
        if column == 'target' or column not in frame:
            continue
        value = str(frame.at[0, column])
        frame[column] = encoder.transform([value if value in encoder.classes_ else encoder.classes_[0]])
    scaler = (artifacts or {}).get('scaler')
    if scaler is not None:
        numeric = frame.select_dtypes(include=['number']).columns
        frame[numeric] = scaler.transform(frame[numeric])
    return frame

@app.post('/predict')
def predict(features: Features):
    if model is None or artifacts is None:
        raise RuntimeError('Upstream model artifacts are missing.')
    prepared = upstream_features(features)
    encoded = model.predict(prepared)[0]
    target_encoder = artifacts['encoders']['target']
    label = str(target_encoder.inverse_transform([encoded])[0])
    confidence = float(max(model.predict_proba(prepared)[0]))
    return {'prediction': f'{label} irrigation need', 'confidence': round(confidence, 3), 'source': 'upstream climate-aware decision tree'}
