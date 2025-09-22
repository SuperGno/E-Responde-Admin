import pandas as pd
import joblib
from math import radians, sin, cos, sqrt, atan2

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

def predict_severity(crime_type):
    encoded_type = crime_encoder.transform([crime_type])
    pred = model.predict([[encoded_type[0]]])
    return severity_encoder.inverse_transform(pred)[0]

def dispatch_report(report, patrol_df):
    lat, lon = report["Latitude"], report["Longitude"]
    severity = report["Severity"]

    if pd.isna(severity) or severity == "":
        severity = predict_severity(report["Crime_Type"])

    available_patrols = patrol_df[patrol_df["Status"] == "Available"]

    if available_patrols.empty:
        return None,

    distances = []
    for _, patrol in available_patrols.iterrows():
        d = haversine(lat, lon, patrol["Latitude"], patrol["Longitude"])
        distances.append((patrol["Police_ID"], d))

    nearest = min(distances, key=lambda x: x[1])
    patrol_id = nearest[0]

    patrol_df.loc[patrol_df["Police_ID"] == patrol_id, "Status"] = "Busy"

    return patrol_id, severity

for i in range(5):
    report = crime_df.iloc[i]
    patrol_id, sev = dispatch_report(report, patrol_df)
    if patrol_id:
        print(f"Dispatch Patrol {patrol_id} → {report['Crime_Type']} ({sev}) at {report['Latitude']}, {report['Longitude']}")
    else:
        print("No patrol available")
