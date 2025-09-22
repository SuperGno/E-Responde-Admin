import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
import joblib  

df = pd.read_csv("crime_reports_with_overlap.csv")

X = df[["Crime_Type"]]  
y = df["Severity"]      

encoder_X = LabelEncoder()
encoder_y = LabelEncoder()

X["Crime_Type"] = encoder_X.fit_transform(X["Crime_Type"])
y = encoder_y.fit_transform(y)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))

joblib.dump(model, "severity_model.pkl")
joblib.dump(encoder_X, "crime_type_encoder.pkl")
joblib.dump(encoder_y, "severity_encoder.pkl")

print("Model trained and saved successfully!")
