// Geotagging service to determine barangay based on coordinates
// Barangay 41 and 43 are located in Tondo, Manila

// Define the boundaries for Barangay 41 and 43 in Tondo, Manila
// Using broader boundaries to catch more reports, then refine based on actual data
const BARANGAY_BOUNDARIES = {
  'Barangay 41': {
    name: 'Barangay 41',
    bounds: {
      north: 14.6500,  // Northern boundary (expanded)
      south: 14.5800,  // Southern boundary (expanded)
      east: 121.0000,   // Eastern boundary (expanded)
      west: 120.9700   // Western boundary (expanded)
    },
    center: [14.6150, 120.9850] // Approximate center coordinates
  },
  'Barangay 43': {
    name: 'Barangay 43',
    bounds: {
      north: 14.6500,  // Northern boundary (expanded)
      south: 14.5800,  // Southern boundary (expanded)
      east: 121.0000,   // Eastern boundary (expanded)
      west: 120.9700   // Western boundary (expanded)
    },
    center: [14.6050, 120.9850] // Approximate center coordinates
  }
}

// Alternative approach: Use coordinate clustering to determine barangay
// This will be used if the boundary approach doesn't work well
export const determineBarangayByClustering = (latitude, longitude, allReports = []) => {
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return null
  }

  // If we have reports, use clustering approach
  if (allReports.length > 0) {
    const validReports = allReports
      .map(report => {
        let lat, lng
        if (report.location) {
          lat = parseFloat(report.location.latitude || report.location.lat || 0)
          lng = parseFloat(report.location.longitude || report.location.lng || 0)
        } else {
          lat = parseFloat(report.latitude || report.lat || 0)
          lng = parseFloat(report.longitude || report.lng || 0)
        }
        return { lat, lng, id: report.id }
      })
      .filter(coord => coord.lat && coord.lng && !isNaN(coord.lat) && !isNaN(coord.lng))

    if (validReports.length === 0) return null

    // Calculate distances to all other points
    const distances = validReports.map(report => ({
      ...report,
      distance: calculateDistance(latitude, longitude, report.lat, report.lng)
    }))

    // Sort by distance and take the closest 10
    const closest = distances.sort((a, b) => a.distance - b.distance).slice(0, 10)
    
    // For now, assign based on latitude (higher lat = Barangay 41, lower lat = Barangay 43)
    const avgLat = closest.reduce((sum, r) => sum + r.lat, 0) / closest.length
    const currentLat = latitude
    
    if (currentLat > avgLat) {
      return 'Barangay 41'
    } else {
      return 'Barangay 43'
    }
  }

  // Fallback to boundary check
  return getBarangayFromCoordinates(latitude, longitude)
}

/**
 * Determine which barangay a set of coordinates belongs to
 * @param {number} latitude - The latitude coordinate
 * @param {number} longitude - The longitude coordinate
 * @returns {string|null} - The barangay name or null if not in either barangay
 */
export const getBarangayFromCoordinates = (latitude, longitude) => {
  console.log('Checking coordinates for barangay:', { latitude, longitude })
  
  // Validate coordinates
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    console.log('Invalid coordinates:', { latitude, longitude })
    return null
  }

  // Check if coordinates are within reasonable bounds for Manila
  if (latitude < 14.0 || latitude > 15.0 || longitude < 120.0 || longitude > 121.0) {
    console.log('Coordinates outside Manila bounds:', { latitude, longitude })
    console.log('Manila bounds: lat 14.0-15.0, lng 120.0-121.0')
    return null
  }

  // Check each barangay boundary
  for (const [barangayName, barangay] of Object.entries(BARANGAY_BOUNDARIES)) {
    const { bounds } = barangay
    
    console.log(`Checking ${barangayName}:`, {
      bounds,
      latitude,
      longitude,
      latCheck: latitude >= bounds.south && latitude <= bounds.north,
      lngCheck: longitude >= bounds.west && longitude <= bounds.east
    })
    
    if (
      latitude >= bounds.south &&
      latitude <= bounds.north &&
      longitude >= bounds.west &&
      longitude <= bounds.east
    ) {
      console.log(`Found match: ${barangayName}`)
      return barangayName
    }
  }

  console.log('No barangay match found')
  return null
}

/**
 * Get barangay information including center coordinates and bounds
 * @param {string} barangayName - The name of the barangay
 * @returns {object|null} - Barangay information or null if not found
 */
export const getBarangayInfo = (barangayName) => {
  return BARANGAY_BOUNDARIES[barangayName] || null
}

/**
 * Get all available barangays
 * @returns {Array} - Array of barangay names
 */
export const getAvailableBarangays = () => {
  return Object.keys(BARANGAY_BOUNDARIES)
}

/**
 * Check if coordinates are within Manila city limits
 * @param {number} latitude - The latitude coordinate
 * @param {number} longitude - The longitude coordinate
 * @returns {boolean} - True if within Manila, false otherwise
 */
export const isWithinManila = (latitude, longitude) => {
  // Manila city bounds (approximate)
  const manilaBounds = {
    north: 14.6500,
    south: 14.5500,
    east: 121.0000,
    west: 120.9500
  }

  return (
    latitude >= manilaBounds.south &&
    latitude <= manilaBounds.north &&
    longitude >= manilaBounds.west &&
    longitude <= manilaBounds.east
  )
}

/**
 * Calculate distance between two coordinates (in kilometers)
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} - Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

/**
 * Find the nearest barangay to given coordinates
 * @param {number} latitude - The latitude coordinate
 * @param {number} longitude - The longitude coordinate
 * @returns {string|null} - The nearest barangay name or null if not found
 */
export const getNearestBarangay = (latitude, longitude) => {
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return null
  }

  let nearestBarangay = null
  let minDistance = Infinity

  for (const [barangayName, barangay] of Object.entries(BARANGAY_BOUNDARIES)) {
    const distance = calculateDistance(
      latitude, 
      longitude, 
      barangay.center[0], 
      barangay.center[1]
    )
    
    if (distance < minDistance) {
      minDistance = distance
      nearestBarangay = barangayName
    }
  }

  // Only return if within reasonable distance (5km)
  return minDistance <= 5 ? nearestBarangay : null
}

/**
 * Process a crime report and add barangay information
 * @param {object} report - The crime report object
 * @param {Array} allReports - All reports for clustering analysis
 * @returns {object} - The report with added barangay information
 */
export const processReportWithGeotagging = (report, allReports = []) => {
  let latitude, longitude

  // Debug: Log the report structure
  console.log('Processing report for geotagging:', {
    id: report.id,
    location: report.location,
    latitude: report.latitude,
    longitude: report.longitude,
    lat: report.lat,
    lng: report.lng
  })

  // Extract coordinates from various possible formats
  if (report.location) {
    latitude = parseFloat(report.location.latitude || report.location.lat || 0)
    longitude = parseFloat(report.location.longitude || report.location.lng || 0)
  } else {
    latitude = parseFloat(report.latitude || report.lat || 0)
    longitude = parseFloat(report.longitude || report.lng || 0)
  }

  // Also check for coordinates in nested objects
  if ((!latitude || !longitude) && report.location && typeof report.location === 'object') {
    // Check for coordinates in nested structure
    if (report.location.coordinates) {
      latitude = parseFloat(report.location.coordinates.latitude || report.location.coordinates.lat || 0)
      longitude = parseFloat(report.location.coordinates.longitude || report.location.coordinates.lng || 0)
    }
    // Check for coordinates array format [lat, lng]
    if (report.location.coords && Array.isArray(report.location.coords)) {
      latitude = parseFloat(report.location.coords[0] || 0)
      longitude = parseFloat(report.location.coords[1] || 0)
    }
  }

  console.log('Extracted coordinates:', { latitude, longitude, type: typeof latitude, type2: typeof longitude })

  // Check if we have valid coordinates
  if (!latitude || !longitude || latitude === 0 || longitude === 0 || isNaN(latitude) || isNaN(longitude)) {
    console.log('No valid coordinates found in report')
    return {
      ...report,
      geotagging: {
        latitude: null,
        longitude: null,
        barangay: null,
        isWithinManila: false,
        nearestBarangay: null
      }
    }
  }

  // Determine barangay using clustering approach
  const barangay = determineBarangayByClustering(latitude, longitude, allReports)
  
  console.log('Geotagging result:', {
    barangay,
    isWithinManila: isWithinManila(latitude, longitude),
    nearestBarangay: getNearestBarangay(latitude, longitude),
    coordinates: { latitude, longitude },
    method: 'clustering'
  })
  
  // Add geotagging information
  return {
    ...report,
    geotagging: {
      latitude,
      longitude,
      barangay,
      isWithinManila: isWithinManila(latitude, longitude),
      nearestBarangay: barangay || getNearestBarangay(latitude, longitude)
    }
  }
}

/**
 * Filter reports by barangay
 * @param {Array} reports - Array of crime reports
 * @param {string} barangayName - The barangay name to filter by
 * @returns {Array} - Filtered reports
 */
export const filterReportsByBarangay = (reports, barangayName) => {
  return reports.filter(report => {
    const processedReport = processReportWithGeotagging(report)
    return processedReport.geotagging.barangay === barangayName
  })
}

/**
 * Get statistics for a specific barangay
 * @param {Array} reports - Array of crime reports
 * @param {string} barangayName - The barangay name
 * @returns {object} - Statistics object
 */
export const getBarangayStatistics = (reports, barangayName) => {
  const barangayReports = filterReportsByBarangay(reports, barangayName)
  
  return {
    barangay: barangayName,
    totalReports: barangayReports.length,
    crimeTypes: [...new Set(barangayReports.map(r => r.crimeType || 'Unknown'))],
    dateRange: {
      earliest: barangayReports.length > 0 ? 
        Math.min(...barangayReports.map(r => new Date(r.dateTime || r.createdAt).getTime())) : null,
      latest: barangayReports.length > 0 ? 
        Math.max(...barangayReports.map(r => new Date(r.dateTime || r.createdAt).getTime())) : null
    }
  }
}

/**
 * Debug function to show coordinate ranges in the data
 * @param {Array} reports - Array of crime reports
 * @returns {object} - Coordinate statistics
 */
export const getCoordinateStatistics = (reports) => {
  const validCoordinates = reports
    .map(report => {
      const processed = processReportWithGeotagging(report, reports)
      return {
        latitude: processed.geotagging.latitude,
        longitude: processed.geotagging.longitude
      }
    })
    .filter(coord => coord.latitude && coord.longitude && !isNaN(coord.latitude) && !isNaN(coord.longitude))

  if (validCoordinates.length === 0) {
    return {
      message: 'No valid coordinates found',
      count: 0
    }
  }

  const latitudes = validCoordinates.map(c => c.latitude)
  const longitudes = validCoordinates.map(c => c.longitude)

  return {
    count: validCoordinates.length,
    latitudeRange: {
      min: Math.min(...latitudes),
      max: Math.max(...latitudes),
      avg: latitudes.reduce((a, b) => a + b, 0) / latitudes.length
    },
    longitudeRange: {
      min: Math.min(...longitudes),
      max: Math.max(...longitudes),
      avg: longitudes.reduce((a, b) => a + b, 0) / longitudes.length
    },
    sampleCoordinates: validCoordinates.slice(0, 5)
  }
}
