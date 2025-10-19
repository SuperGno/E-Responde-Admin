#!/usr/bin/env python3
"""
Simple ARIMA API Runner - Run this to start the API server
"""

import sys
import os

# Add the API directory to Python path
api_dir = os.path.join(os.path.dirname(__file__), '..', 'arima_forecasting_api', 'app')
sys.path.insert(0, api_dir)

try:
    from api import app
    
    print("=" * 60)
    print("🚀 ARIMA Crime Forecasting API Server")
    print("=" * 60)
    print("📍 Server starting at: http://127.0.0.1:5000")
    print("🔗 Test URL: http://127.0.0.1:5000/api/locations")
    print("📊 Analytics URL: http://localhost:5173")
    print("⏹️  Press Ctrl+C to stop the server")
    print("=" * 60)
    print()
    
    # Start the Flask server
    app.run(
        debug=False,  # Set to False for production
        host='127.0.0.1',
        port=5000,
        use_reloader=False
    )
    
except ImportError as e:
    print(f"❌ Error: Cannot import API module")
    print(f"   Details: {e}")
    print(f"   API directory: {api_dir}")
    print("   Make sure the arima_forecasting_api folder exists")
    input("Press Enter to exit...")
    sys.exit(1)
    
except Exception as e:
    print(f"❌ Error starting server: {e}")
    input("Press Enter to exit...")
    sys.exit(1)
