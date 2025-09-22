from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import joblib
from math import radians, sin, cos, sqrt, atan2

app = FastAPI(title="E-Responde AI Dispatch API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

crime_df = pd.read_csv("crime_reports_with_overlap.csv")
patrol_df = pd.read_csv("patrol_units_dataset.csv")

model = joblib.load("severity_model.pkl")
crime_encoder = joblib.load("crime_type_encoder.pkl")
severity_encoder = joblib.load("severity_encoder.pkl")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

def predict_severity(crime_type: str):
    encoded_type = crime_encoder.transform([crime_type])
    pred = model.predict([[encoded_type[0]]])
    return severity_encoder.inverse_transform(pred)[0]

class PredictPayload(BaseModel):
    crime_type: str

class DispatchPayload(BaseModel):
    crime_type: str
    latitude: float
    longitude: float
    severity: str | None = None

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict-severity")
def predict(payload: PredictPayload):
    sev = predict_severity(payload.crime_type)
    return {"severity": sev}

@app.post("/dispatch")
def dispatch(payload: DispatchPayload):
    lat, lon = payload.latitude, payload.longitude
    severity = payload.severity or predict_severity(payload.crime_type)

    available_patrols = patrol_df[patrol_df["Status"] == "Available"]
    if available_patrols.empty:
        return {"patrol_id": None, "severity": severity, "message": "No patrol available"}

    distances: list[tuple[str, float]] = []
    for _, patrol in available_patrols.iterrows():
        d = haversine(lat, lon, patrol["Latitude"], patrol["Longitude"])
        # Keep Police_ID as string (e.g., "P001")
        distances.append((str(patrol["Police_ID"]), d))

    patrol_id, _ = min(distances, key=lambda x: x[1])
    patrol_df.loc[patrol_df["Police_ID"] == patrol_id, "Status"] = "Busy"

    return {"patrol_id": patrol_id, "severity": severity}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)


