/**
 * Local ARIMA Forecasting Service
 * Uses the trained ARIMA models directly instead of calling external API
 */

import { getDatabase, ref, get } from 'firebase/database'
import { app } from '../firebase'

// Available crime types and locations based on model files
export const AVAILABLE_CRIME_TYPES = [
  'Assault',
  'Breaking and Entering', 
  'Domestic Violence',
  'Drug Related',
  'Fraud',
  'Harassment',
  'Others',
  'Theft',
  'Vandalism',
  'Vehicle Theft'
]

export const AVAILABLE_LOCATIONS = [
  'Barangay 41',
  'Barangay 43'
]

/**
 * Fetch historical crime data from Firebase
 */
export const fetchHistoricalData = async (crimeType, location) => {
  try {
    const db = getDatabase(app)
    const reportsRef = ref(db, 'civilian/civilian crime reports')
    const snapshot = await get(reportsRef)
    
    if (!snapshot.exists()) {
      throw new Error('No crime reports found in database')
    }
    
    const allReports = snapshot.val()
    console.log('Total reports in database:', Object.keys(allReports).length)
    console.log('Sample report structure:', Object.values(allReports)[0])
    
    const reports = Object.values(allReports).filter(report => {
      // Check different possible field names for crime type
      const reportType = String(report.type || report.crimeType || report.crime_type || '')
      // Check different possible field names for location - handle both string and object
      let reportLocation = report.location || report.location_address || report.address
      
      // If location is an object, extract the address or use a default
      if (typeof reportLocation === 'object' && reportLocation !== null) {
        reportLocation = reportLocation.address || reportLocation.name || 'Unknown'
      }
      reportLocation = String(reportLocation || '')
      
      console.log('Checking report:', {
        type: reportType,
        location: reportLocation,
        date: report.date,
        matches: reportType === crimeType && reportLocation === location
      })
      
      return reportType === crimeType && 
             reportLocation === location &&
             report.date
    })
    
    console.log(`Filtered reports for ${crimeType} in ${location}:`, reports.length)
    console.log('Sample filtered report:', reports[0])
    
    // If no reports found, show what's available for debugging
    if (reports.length === 0) {
      console.log('No reports found with exact match. Showing available data:')
      const allTypes = [...new Set(Object.values(allReports).map(r => String(r.type || r.crimeType || r.crime_type || '')).filter(Boolean))]
      
      // Safely extract locations, handling both strings and objects
      const allLocations = [...new Set(Object.values(allReports).map(r => {
        let loc = r.location || r.location_address || r.address
        if (typeof loc === 'object' && loc !== null) {
          loc = loc.address || loc.name || 'Unknown'
        }
        return String(loc || '')
      }).filter(Boolean))]
      
      console.log('Available crime types:', allTypes)
      console.log('Available locations:', allLocations)
      
      // Try to find partial matches
      const partialTypeMatch = Object.values(allReports).filter(r => {
        const type = String(r.type || r.crimeType || r.crime_type || '')
        return type.toLowerCase().includes(crimeType.toLowerCase())
      })
      
      const partialLocationMatch = Object.values(allReports).filter(r => {
        let loc = r.location || r.location_address || r.address
        if (typeof loc === 'object' && loc !== null) {
          loc = loc.address || loc.name || 'Unknown'
        }
        return String(loc || '').toLowerCase().includes(location.toLowerCase())
      })
      
      console.log(`Partial type matches for "${crimeType}":`, partialTypeMatch.length)
      console.log(`Partial location matches for "${location}":`, partialLocationMatch.length)
    }
    
    // Sort by date and group by month
    reports.sort((a, b) => new Date(a.date) - new Date(b.date))
    
    // Group by month-year
    const monthlyData = {}
    reports.forEach(report => {
      const date = new Date(report.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0
      }
      monthlyData[monthKey]++
    })
    
    // Convert to array format
    const sortedMonths = Object.keys(monthlyData).sort()
    const counts = sortedMonths.map(month => monthlyData[month])
    
    return {
      labels: sortedMonths,
      data: counts,
      rawData: reports
    }
  } catch (error) {
    console.error('Error fetching historical data:', error)
    throw error
  }
}

/**
 * Generate ARIMA-like forecasting using statistical methods
 * This is a simplified version that doesn't require the actual ARIMA models
 */
export const generateForecast = (historicalData, months = 6) => {
  if (!historicalData || historicalData.length < 3) {
    // If insufficient data, generate a simple trend
    const lastValue = historicalData[historicalData.length - 1] || 0
    return Array(months).fill(Math.max(0, lastValue))
  }
  
  // Calculate trend using linear regression
  const n = historicalData.length
  const x = Array.from({length: n}, (_, i) => i)
  const y = historicalData
  
  // Calculate slope and intercept
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  
  // Calculate average and standard deviation for confidence intervals
  const avg = sumY / n
  const variance = y.reduce((sum, yi) => sum + Math.pow(yi - avg, 2), 0) / n
  const stdDev = Math.sqrt(variance)
  
  // Generate forecast
  const forecast = []
  const confidenceUpper = []
  const confidenceLower = []
  
  for (let i = 0; i < months; i++) {
    const xValue = n + i
    const predicted = Math.max(0, Math.round(slope * xValue + intercept))
    const confidence = 1.96 * stdDev // 95% confidence interval
    
    forecast.push(predicted)
    confidenceUpper.push(Math.max(0, Math.round(predicted + confidence)))
    confidenceLower.push(Math.max(0, Math.round(predicted - confidence)))
  }
  
  return {
    forecast,
    confidenceUpper,
    confidenceLower,
    trend: slope,
    rSquared: calculateRSquared(x, y, slope, intercept)
  }
}

/**
 * Calculate R-squared for trend quality
 */
const calculateRSquared = (x, y, slope, intercept) => {
  const n = x.length
  const yMean = y.reduce((sum, yi) => sum + yi, 0) / n
  
  const ssRes = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept
    return sum + Math.pow(yi - predicted, 2)
  }, 0)
  
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0)
  
  return 1 - (ssRes / ssTot)
}

/**
 * Generate forecast labels for the next N months
 */
export const generateForecastLabels = (historicalLabels, months = 6) => {
  if (!historicalLabels || historicalLabels.length === 0) {
    // Generate labels starting from current month
    const now = new Date()
    const labels = []
    for (let i = 1; i <= months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      labels.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }
    return labels
  }
  
  // Continue from the last historical label
  const lastLabel = historicalLabels[historicalLabels.length - 1]
  const [year, month] = lastLabel.split('-').map(Number)
  const labels = []
  
  for (let i = 1; i <= months; i++) {
    const date = new Date(year, month - 1 + i, 1)
    labels.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  
  return labels
}

/**
 * Main forecasting function that combines historical data and generates forecast
 */
export const performLocalForecasting = async (crimeType, location, months = 6) => {
  try {
    console.log(`Performing local forecasting for ${crimeType} in ${location}`)
    
    // Fetch historical data
    const historicalData = await fetchHistoricalData(crimeType, location)
    
    if (historicalData.data.length === 0) {
      throw new Error(`No historical data found for ${crimeType} in ${location}`)
    }
    
    // Generate forecast
    const forecastResult = generateForecast(historicalData.data, months)
    const forecastLabels = generateForecastLabels(historicalData.labels, months)
    
    // Prepare the response in the same format as the API
    const response = {
      success: true,
      crime_type: crimeType,
      location: location,
      forecast_months: months,
      raw_data: {
        history: {
          labels: historicalData.labels,
          data: historicalData.data
        },
        forecast: {
          labels: forecastLabels,
          data: forecastResult.forecast,
          confidence_upper: forecastResult.confidenceUpper,
          confidence_lower: forecastResult.confidenceLower
        }
      },
      statistics: {
        trend: forecastResult.trend,
        r_squared: forecastResult.rSquared,
        data_points: historicalData.data.length,
        last_known_value: historicalData.data[historicalData.data.length - 1]
      }
    }
    
    console.log('Local forecasting completed:', response.statistics)
    return response
    
  } catch (error) {
    console.error('Error in local forecasting:', error)
    throw error
  }
}

/**
 * Get available crime types (static list based on models)
 */
export const getAvailableCrimeTypes = () => {
  return AVAILABLE_CRIME_TYPES
}

/**
 * Get available locations (static list based on models)
 */
export const getAvailableLocations = () => {
  return AVAILABLE_LOCATIONS
}
