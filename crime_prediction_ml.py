import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
import joblib
import json
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class CrimePredictionML:
    def __init__(self):
        self.models = {}
        self.label_encoders = {}
        self.scalers = {}
        self.crime_types = [
            'Assault', 'Theft', 'Vandalism', 'Fraud', 'Harassment',
            'Breaking and Entering', 'Vehicle Theft', 'Drug-related',
            'Domestic Violence', 'Other'
        ]
        
    def prepare_data(self, firebase_data):
        """Convert Firebase data to ML-ready format"""
        df = pd.DataFrame(firebase_data)
        
        if df.empty:
            return pd.DataFrame()
            
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Extract time features
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['month'] = df['timestamp'].dt.month
        df['day_of_month'] = df['timestamp'].dt.day
        df['is_weekend'] = df['timestamp'].dt.dayofweek >= 5
        df['is_holiday'] = self._is_holiday(df['timestamp'])
        
        # Create rolling features
        df = df.sort_values('timestamp')
        df['rolling_7day'] = df['value'].rolling(window=7, min_periods=1).mean()
        df['rolling_30day'] = df['value'].rolling(window=30, min_periods=1).mean()
        
        # Lag features
        df['lag_1day'] = df['value'].shift(1)
        df['lag_7day'] = df['value'].shift(7)
        df['lag_30day'] = df['value'].shift(30)
        
        return df
    
    def _is_holiday(self, dates):
        """Simple holiday detection (can be enhanced)"""
        holidays = []
        for date in dates:
            # Add your holiday logic here
            # For now, just mark weekends as potential holidays
            if date.dayofweek >= 5:
                holidays.append(1)
            else:
                holidays.append(0)
        return holidays
    
    def create_features(self, df, crime_type=None):
        """Create features for ML model"""
        if df.empty:
            return pd.DataFrame(), pd.Series()
        
        # Filter by crime type if specified
        if crime_type and 'crimeType' in df.columns:
            df = df[df['crimeType'] == crime_type]
        
        # Feature columns
        feature_cols = [
            'hour', 'day_of_week', 'month', 'day_of_month',
            'is_weekend', 'is_holiday', 'rolling_7day', 'rolling_30day',
            'lag_1day', 'lag_7day', 'lag_30day'
        ]
        
        # Remove rows with NaN values
        df_clean = df.dropna(subset=feature_cols + ['value'])
        
        if df_clean.empty:
            return pd.DataFrame(), pd.Series()
        
        X = df_clean[feature_cols]
        y = df_clean['value']
        
        return X, y
    
    def train_models(self, firebase_data):
        """Train ML models for each crime type"""
        results = {}
        
        # Prepare data
        df = self.prepare_data(firebase_data)
        if df.empty:
            return {"error": "No data available for training"}
        
        # Train model for each crime type
        for crime_type in self.crime_types:
            try:
                # Filter data for this crime type
                crime_data = df[df['crimeType'] == crime_type] if 'crimeType' in df.columns else df
                
                if len(crime_data) < 10:  # Need minimum data points
                    continue
                
                # Create features
                X, y = self.create_features(crime_data, crime_type)
                
                if X.empty or len(X) < 5:
                    continue
                
                # Split data
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=0.2, random_state=42
                )
                
                # Train Random Forest
                rf_model = RandomForestRegressor(
                    n_estimators=100,
                    max_depth=10,
                    min_samples_split=5,
                    random_state=42
                )
                rf_model.fit(X_train, y_train)
                
                # Train Gradient Boosting
                gb_model = GradientBoostingRegressor(
                    n_estimators=100,
                    learning_rate=0.1,
                    max_depth=6,
                    random_state=42
                )
                gb_model.fit(X_train, y_train)
                
                # Evaluate models
                rf_score = rf_model.score(X_test, y_test)
                gb_score = gb_model.score(X_test, y_test)
                
                # Choose best model
                if rf_score > gb_score:
                    best_model = rf_model
                    model_type = "RandomForest"
                else:
                    best_model = gb_model
                    model_type = "GradientBoosting"
                
                # Calculate accuracy metrics
                y_pred = best_model.predict(X_test)
                mae = mean_absolute_error(y_test, y_pred)
                r2 = r2_score(y_test, y_pred)
                accuracy = max(0, (1 - mae / y_test.mean()) * 100)
                
                # Store model
                self.models[crime_type] = best_model
                
                results[crime_type] = {
                    "model_type": model_type,
                    "accuracy": round(accuracy, 2),
                    "r2_score": round(r2, 3),
                    "mae": round(mae, 2),
                    "training_samples": len(X_train),
                    "test_samples": len(X_test)
                }
                
            except Exception as e:
                results[crime_type] = {"error": str(e)}
        
        return results
    
    def predict_crimes(self, crime_type, prediction_days=30):
        """Predict crimes for specific crime type"""
        if crime_type not in self.models:
            return {"error": f"No model trained for {crime_type}"}
        
        model = self.models[crime_type]
        predictions = []
        
        # Generate future dates
        start_date = datetime.now()
        
        for i in range(1, prediction_days + 1):
            future_date = start_date + timedelta(days=i)
            
            # Create features for future date
            features = {
                'hour': 12,  # Default to noon
                'day_of_week': future_date.weekday(),
                'month': future_date.month,
                'day_of_month': future_date.day,
                'is_weekend': future_date.weekday() >= 5,
                'is_holiday': 0,  # Can be enhanced
                'rolling_7day': 0,  # Will be calculated
                'rolling_30day': 0,  # Will be calculated
                'lag_1day': 0,  # Will be calculated
                'lag_7day': 0,  # Will be calculated
                'lag_30day': 0   # Will be calculated
            }
            
            # Convert to DataFrame
            feature_df = pd.DataFrame([features])
            
            try:
                # Make prediction
                prediction = model.predict(feature_df)[0]
                prediction = max(0, prediction)  # Ensure non-negative
                
                predictions.append({
                    'date': future_date.strftime('%Y-%m-%d'),
                    'day_of_week': future_date.strftime('%A'),
                    'predicted_crimes': round(prediction, 1),
                    'risk_level': self._calculate_risk_level(prediction, crime_type)
                })
                
            except Exception as e:
                predictions.append({
                    'date': future_date.strftime('%Y-%m-%d'),
                    'day_of_week': future_date.strftime('%A'),
                    'predicted_crimes': 0,
                    'risk_level': 'Low',
                    'error': str(e)
                })
        
        return predictions
    
    def _calculate_risk_level(self, prediction, crime_type):
        """Calculate risk level based on prediction"""
        # Define thresholds for each crime type
        thresholds = {
            'Assault': {'high': 5, 'medium': 2},
            'Theft': {'high': 8, 'medium': 3},
            'Vandalism': {'high': 6, 'medium': 2},
            'Fraud': {'high': 4, 'medium': 1},
            'Harassment': {'high': 3, 'medium': 1},
            'Breaking and Entering': {'high': 4, 'medium': 1},
            'Vehicle Theft': {'high': 3, 'medium': 1},
            'Drug-related': {'high': 5, 'medium': 2},
            'Domestic Violence': {'high': 4, 'medium': 1},
            'Other': {'high': 6, 'medium': 2}
        }
        
        threshold = thresholds.get(crime_type, {'high': 5, 'medium': 2})
        
        if prediction >= threshold['high']:
            return 'High'
        elif prediction >= threshold['medium']:
            return 'Medium'
        else:
            return 'Low'
    
    def get_all_predictions(self, prediction_days=30):
        """Get predictions for all crime types"""
        all_predictions = {}
        
        for crime_type in self.crime_types:
            if crime_type in self.models:
                predictions = self.predict_crimes(crime_type, prediction_days)
                all_predictions[crime_type] = predictions
        
        return all_predictions
    
    def save_models(self, filepath='crime_models.pkl'):
        """Save trained models"""
        model_data = {
            'models': self.models,
            'crime_types': self.crime_types
        }
        joblib.dump(model_data, filepath)
    
    def load_models(self, filepath='crime_models.pkl'):
        """Load trained models"""
        try:
            model_data = joblib.load(filepath)
            self.models = model_data['models']
            self.crime_types = model_data['crime_types']
            return True
        except:
            return False

# Flask API for integration
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Global ML instance
ml_predictor = CrimePredictionML()

@app.route('/api/train-models', methods=['POST'])
def train_models():
    """Train ML models with Firebase data"""
    try:
        data = request.json
        firebase_data = data.get('firebase_data', [])
        
        if not firebase_data:
            return jsonify({"error": "No data provided"}), 400
        
        # Train models
        results = ml_predictor.train_models(firebase_data)
        
        return jsonify({
            "success": True,
            "results": results,
            "message": "Models trained successfully"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict-crimes', methods=['POST'])
def predict_crimes():
    """Get crime predictions"""
    try:
        data = request.json
        crime_type = data.get('crime_type', '')
        prediction_days = data.get('prediction_days', 30)
        
        if not crime_type:
            return jsonify({"error": "Crime type required"}), 400
        
        # Get predictions
        predictions = ml_predictor.predict_crimes(crime_type, prediction_days)
        
        return jsonify({
            "success": True,
            "crime_type": crime_type,
            "predictions": predictions,
            "prediction_days": prediction_days
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict-all-crimes', methods=['POST'])
def predict_all_crimes():
    """Get predictions for all crime types"""
    try:
        data = request.json
        prediction_days = data.get('prediction_days', 30)
        
        # Get all predictions
        all_predictions = ml_predictor.get_all_predictions(prediction_days)
        
        return jsonify({
            "success": True,
            "all_predictions": all_predictions,
            "prediction_days": prediction_days
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/model-status', methods=['GET'])
def model_status():
    """Get status of trained models"""
    try:
        status = {}
        for crime_type in ml_predictor.crime_types:
            status[crime_type] = crime_type in ml_predictor.models
        
        return jsonify({
            "success": True,
            "models_trained": status,
            "total_models": len(ml_predictor.models)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🤖 Crime Prediction ML Server Starting...")
    print("📊 Available Endpoints:")
    print("  POST /api/train-models - Train ML models")
    print("  POST /api/predict-crimes - Get predictions for specific crime type")
    print("  POST /api/predict-all-crimes - Get predictions for all crime types")
    print("  GET /api/model-status - Check model status")
    print("\n🚀 Server running on http://localhost:5001")
    
    app.run(host='0.0.0.0', port=5001, debug=True)

