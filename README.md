# Fieldwise: AI-Based Area-Wise Precision Irrigation Scheduler

A beginner-friendly college mini-project for software-only irrigation planning around Chhatrapati Sambhajinagar, Maharashtra. It combines live Open-Meteo weather, modeled soil moisture and ET0, a Python climate-aware ML adapter, and transparent rule validation.

> **Academic prototype:** the supplied ML foundation is adapted behind `ml-service/main.py`. It is not scientifically validated for Chhatrapati Sambhajinagar and must not be treated as agronomic advice.

## Architecture

React + Vite -> Express API -> MongoDB -> Open-Meteo + FastAPI ML adapter

The backend stores farmer login details, crop/field details, schedules, alerts, and irrigation history in MongoDB. For offline development only, set `USE_JSON_STORAGE=true` to use `server/storage.json`.

## Requirements

- Node.js 18+
- Python 3.10+
- Internet access for Open-Meteo and map tiles

## Run locally

### MongoDB setup

1. In MongoDB Atlas, create a free cluster, a database user, and add your current IP address under **Network Access**.
2. Click **Connect** → **Drivers** → **Node.js** and copy the `mongodb+srv://...` connection string.
3. Copy `.env.example` to `.env` in the project root. Paste the string as `MONGODB_URI`, replace `<password>` with the URL-encoded database-user password, and use `precision_irrigation` as the database name.
4. Start the API. A successful connection prints `MongoDB connected: precision_irrigation`.

```powershell
# from the project root
npm install
npm install --prefix server
npm install --prefix client

# terminal 1: ML adapter
cd ml-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# terminal 2: Express API
cd server
npm run dev

# terminal 3: React dashboard
cd client
npm run dev
```

Open the Vite URL shown in terminal, normally `http://localhost:5173`.

The API reads `PORT`, `ML_SERVICE_URL`, and `VITE_API_URL`. Vite environment variables must be placed in `client/.env` when overriding the frontend API URL.

## API routes

- `POST /api/farmers/signin`
- `GET/POST /api/areas`
- `GET/DELETE /api/areas/:id`
- `GET /api/weather/:areaId`
- `GET /api/weather/:areaId/forecast`
- `POST /api/irrigation/analyze/:areaId`
- `POST /api/irrigation/log/:areaId`
- `GET /api/irrigation/history/:areaId`
- `GET /api/irrigation/schedules`
- `GET /api/alerts`
- `PUT /api/alerts/:id/read`

Farmer accounts use a username and password; the mobile-number field is not used. Passwords are hashed with Node's built-in SHA-256 helper for this academic prototype. MongoDB keeps farmer profile data, field/crop parameters (`farmerId`, village, taluka, district, crop, farm size, soil type, GPS coordinates, sowing date), schedules, and irrigation history in separate linked collections.

Irrigation timing uses crop standards (`Sugarcane` 4 days, `Cotton` 6, `Soybean` 7, `Onion` 3, `Wheat` 8), crop-specific duration per acre, the next four days of rain probability, and the farmer's recorded irrigation history. A rain forecast schedules after the rain; recent watering delays the next date; otherwise the result is scheduled for tomorrow or next week.

## Decision rules

1. Rain probability at least 60%: don't irrigate.
2. Modeled soil moisture at least 45%: don't irrigate.
3. Otherwise, high ML need: irrigate.
4. Medium ML need: wait / monitor.
5. Low ML need: don't irrigate.

Every result includes the rule reason, time, duration, confidence, and ML source. The Python service loads the upstream repository's saved decision-tree model and preprocessing artifacts from `ml-service/models`. Its additional soil-lab and farm-management fields use explicit academic defaults because Open-Meteo cannot provide them.

## ML model setup

The upstream artifacts are already copied into `ml-service/models`. To refresh them:

```powershell
Copy-Item ml-service/upstream/irrigation_project/models/decision_tree_model.pkl ml-service/models/decision_tree_model.pkl -Force
Copy-Item ml-service/upstream/irrigation_project/models/preprocessing_artifacts.pkl ml-service/models/preprocessing_artifacts.pkl -Force
```

Start the service with the Python interpreter selected for the `ml-service` folder:

```powershell
cd ml-service
uvicorn main:app --reload --port 8000
```
