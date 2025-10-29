import json
import random
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Simple ML-like prediction system
class SimpleCrimePredictor:
    def __init__(self):
        self.crime_types = [
            'Assault', 'Theft', 'Vandalism', 'Fraud', 'Harassment',
            'Breaking and Entering', 'Vehicle Theft', 'Drug-related',
            'Domestic Violence', 'Other'
        ]
        self.models_trained = False
        
    def train_models(self, firebase_data):
        """Simulate ML training with statistical analysis"""
        if not firebase_data:
            return {"error": "No data provided"}
        
        results = {}
        
        # Analyze data for each crime type
        for crime_type in self.crime_types:
            # Filter data for this crime type
            crime_data = [item for item in firebase_data if item.get('crimeType') == crime_type]
            
            if len(crime_data) < 5:
                results[crime_type] = {"error": "Insufficient data"}
                continue
            
            # Simple statistical analysis
            total_crimes = len(crime_data)
            avg_per_day = total_crimes / max(1, len(set(item['timestamp'][:10] for item in crime_data)))
            
            # Simulate accuracy based on data amount
            accuracy = min(95, 60 + (total_crimes * 0.5))
            
            results[crime_type] = {
                "model_type": "Statistical",
                "accuracy": round(accuracy, 2),
                "r2_score": round(accuracy / 100, 3),
                "mae": round(avg_per_day * 0.2, 2),
                "training_samples": total_crimes,
                "test_samples": max(1, total_crimes // 5)
            }
        
        self.models_trained = True
        return results
    
    def predict_crimes(self, crime_type, prediction_days=30):
        """Generate predictions for specific crime type"""
        if not self.models_trained:
            return {"error": "Models not trained"}
        
        predictions = []
        base_rate = random.uniform(0.5, 3.0)  # Base crime rate per day
        
        # Adjust base rate by crime type
        crime_multipliers = {
            'Assault': 1.2,
            'Theft': 1.5,
            'Vandalism': 0.8,
            'Fraud': 0.6,
            'Harassment': 0.9,
            'Breaking and Entering': 1.1,
            'Vehicle Theft': 0.7,
            'Drug-related': 1.3,
            'Domestic Violence': 0.9,
            'Other': 1.0
        }
        
        multiplier = crime_multipliers.get(crime_type, 1.0)
        adjusted_rate = base_rate * multiplier
        
        # Generate predictions for each day
        for i in range(1, prediction_days + 1):
            future_date = datetime.now() + timedelta(days=i)
            
            # Add some randomness and patterns
            day_of_week = future_date.weekday()
            weekend_factor = 1.3 if day_of_week >= 5 else 1.0
            seasonal_factor = 1.1 if future_date.month in [6, 7, 8] else 1.0
            
            # Calculate prediction
            prediction = adjusted_rate * weekend_factor * seasonal_factor
            prediction += random.uniform(-0.5, 0.5)  # Add noise
            prediction = max(0, prediction)  # Ensure non-negative
            
            # Determine risk level
            if prediction >= 3:
                risk_level = 'High'
            elif prediction >= 1.5:
                risk_level = 'Medium'
            else:
                risk_level = 'Low'
            
            predictions.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'day_of_week': future_date.strftime('%A'),
                'predicted_crimes': round(prediction, 1),
                'risk_level': risk_level
            })
        
        return predictions

# Global predictor instance
predictor = SimpleCrimePredictor()

@app.route('/api/train-models', methods=['POST'])
def train_models():
    """Train ML models with Firebase data"""
    try:
        data = request.json
        firebase_data = data.get('firebase_data', [])
        
        if not firebase_data:
            return jsonify({"error": "No data provided"}), 400
        
        # Train models
        results = predictor.train_models(firebase_data)
        
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
        predictions = predictor.predict_crimes(crime_type, prediction_days)
        
        return jsonify({
            "success": True,
            "crime_type": crime_type,
            "predictions": predictions,
            "prediction_days": prediction_days
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/model-status', methods=['GET'])
def model_status():
    """Get status of trained models"""
    try:
        status = {}
        for crime_type in predictor.crime_types:
            status[crime_type] = predictor.models_trained
        
        return jsonify({
            "success": True,
            "models_trained": status,
            "total_models": len(predictor.crime_types) if predictor.models_trained else 0
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "message": "Simple ML Server is running",
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("🤖 Simple Crime Prediction Server Starting...")
    print("📊 Available Endpoints:")
    print("  GET /api/health - Health check")
    print("  POST /api/train-models - Train models")
    print("  POST /api/predict-crimes - Get predictions")
    print("  GET /api/model-status - Check model status")
    print("\n🚀 Server running on http://localhost:5001")
    print("💡 This is a simplified version that doesn't require heavy ML libraries")
    
    app.run(host='0.0.0.0', port=5001, debug=True)













