#!/usr/bin/env python3
"""
Direct ARIMA API Starter - This will definitely work!
"""

import sys
import os
import subprocess

def main():
    print("=" * 60)
    print("🚀 ARIMA Crime Forecasting API - Direct Start")
    print("=" * 60)
    
    # Get the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    api_dir = os.path.join(current_dir, '..', 'arima_forecasting_api', 'app')
    api_dir = os.path.abspath(api_dir)
    
    print(f"📁 Current directory: {current_dir}")
    print(f"📁 API directory: {api_dir}")
    
    # Check if API directory exists
    if not os.path.exists(api_dir):
        print(f"❌ Error: API directory not found at {api_dir}")
        print("   Make sure the arima_forecasting_api folder exists")
        input("Press Enter to exit...")
        return
    
    # Check if api.py exists
    api_file = os.path.join(api_dir, 'api.py')
    if not os.path.exists(api_file):
        print(f"❌ Error: api.py not found at {api_file}")
        input("Press Enter to exit...")
        return
    
    print("✅ API files found!")
    print("🚀 Starting server...")
    print("📍 Server will be available at: http://127.0.0.1:5000")
    print("🔗 Test URL: http://127.0.0.1:5000/api/locations")
    print("⏹️  Press Ctrl+C to stop the server")
    print("=" * 60)
    print()
    
    try:
        # Change to API directory and run the server
        os.chdir(api_dir)
        
        # Import and run the Flask app
        sys.path.insert(0, api_dir)
        from api import app
        
        app.run(
            debug=False,
            host='127.0.0.1',
            port=5000,
            use_reloader=False
        )
        
    except ImportError as e:
        print(f"❌ Import Error: {e}")
        print("   Make sure all dependencies are installed:")
        print("   pip install flask flask-cors pandas numpy")
        input("Press Enter to exit...")
    except Exception as e:
        print(f"❌ Error: {e}")
        input("Press Enter to exit...")

if __name__ == "__main__":
    main()
