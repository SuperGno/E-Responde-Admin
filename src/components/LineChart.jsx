import React from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const LineChart = ({ 
  historicalData = [], 
  forecastData = [], 
  title = "Crime Analysis",
  showConfidenceInterval = false,
  confidenceUpper = [],
  confidenceLower = []
}) => {
  console.log('📈 LineChart rendered with:', {
    historicalDataLength: historicalData.length,
    forecastDataLength: forecastData.length,
    historicalSample: historicalData.slice(0, 2),
    forecastSample: forecastData.slice(0, 2)
  })
  
  // Calculate trend percentage
  const calculateTrendPercentage = () => {
    if (historicalData.length < 2) return 0
    
    const firstValue = historicalData[0]?.value || 0
    const lastValue = historicalData[historicalData.length - 1]?.value || 0
    
    if (firstValue === 0) return lastValue > 0 ? 100 : 0
    
    const percentageChange = ((lastValue - firstValue) / firstValue) * 100
    return Math.round(percentageChange * 100) / 100 // Round to 2 decimal places
  }
  
  const trendPercentage = calculateTrendPercentage()
  const trendDirection = trendPercentage > 0 ? 'up' : trendPercentage < 0 ? 'down' : 'stable'
  const trendColor = trendPercentage > 0 ? '#ef4444' : trendPercentage < 0 ? '#10b981' : '#6b7280'
  
  // Prepare data for Chart.js
  const allLabels = [
    ...historicalData.map(item => item.date || item.label),
    ...forecastData.map(item => item.date || item.label)
  ]

  const historicalValues = historicalData.map(item => item.value)
  const forecastValues = forecastData.map(item => item.value)
  
  console.log('📊 Chart values:', {
    historicalValues,
    forecastValues,
    allLabels,
    trendPercentage,
    trendDirection
  })

  // Create datasets - only show if there's data
  const datasets = []
  
  // Only add historical data if it exists
  if (historicalValues.length > 0) {
    datasets.push({
      label: 'Historical Data',
      data: [...historicalValues, ...new Array(forecastValues.length).fill(null)],
      borderColor: 'rgb(59, 130, 246)', // Blue
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 3,
      fill: false,
      tension: 0.1,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: 'rgb(59, 130, 246)',
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    })
  }
  
  // Only add forecast data if it exists
  if (forecastValues.length > 0) {
    datasets.push({
      label: 'Forecast',
      data: [...new Array(historicalValues.length).fill(null), ...forecastValues],
      borderColor: 'rgb(239, 68, 68)', // Red
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 3,
      borderDash: [5, 5],
      fill: false,
      tension: 0.1,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: 'rgb(239, 68, 68)',
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    })
  }

  // Add confidence interval if available
  if (showConfidenceInterval && confidenceUpper.length > 0 && confidenceLower.length > 0) {
    const upperValues = confidenceUpper.map(item => item.value)
    const lowerValues = confidenceLower.map(item => item.value)
    
    datasets.push({
      label: 'Confidence Upper',
      data: [...new Array(historicalValues.length).fill(null), ...upperValues],
      borderColor: 'rgba(239, 68, 68, 0.3)',
      backgroundColor: 'rgba(239, 68, 68, 0.05)',
      borderWidth: 1,
      borderDash: [2, 2],
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 0
    })

    datasets.push({
      label: 'Confidence Lower',
      data: [...new Array(historicalValues.length).fill(null), ...lowerValues],
      borderColor: 'rgba(239, 68, 68, 0.3)',
      backgroundColor: 'rgba(239, 68, 68, 0.05)',
      borderWidth: 1,
      borderDash: [2, 2],
      fill: '-1',
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 0,
      stepped: false
    })
  }

  const chartData = {
    labels: allLabels.length > 0 ? allLabels : ['No Data'],
    datasets: datasets
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      title: {
        display: true,
        text: `${title}${historicalData.length > 0 ? ` (${trendPercentage > 0 ? '+' : ''}${trendPercentage}% ${trendDirection})` : ''}`,
        font: {
          size: 16,
          weight: 'bold'
        },
        color: historicalData.length > 0 ? trendColor : '#374151',
        padding: {
          top: 10,
          bottom: 30
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: function(context) {
            return `Month: ${context[0].label}`
          },
          label: function(context) {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            return `${label}: ${value} crimes`
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time Period',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Number of Crimes',
          font: {
            size: 12,
            weight: 'bold'
          }
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        },
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          callback: function(value) {
            return Number.isInteger(value) ? value : null
          }
        }
      }
    },
    elements: {
      point: {
        hoverBackgroundColor: '#fff'
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    }
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-4">
      {/* Trend Indicator */}
      {historicalData.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Trend:</span>
            <div className="flex items-center space-x-1">
              {trendDirection === 'up' && (
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {trendDirection === 'down' && (
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {trendDirection === 'stable' && (
                <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              )}
              <span 
                className="text-sm font-semibold"
                style={{ color: trendColor }}
              >
                {trendPercentage > 0 ? '+' : ''}{trendPercentage}%
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {historicalData.length} data points
          </div>
        </div>
      )}
      
      {/* No Data Message */}
      {historicalData.length === 0 && forecastData.length === 0 && (
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-500 mb-2">No Data Available</h3>
            <p className="text-sm text-gray-400">
              No historical data found for the selected crime type and location.
            </p>
          </div>
        </div>
      )}
      
      {/* Chart - only show if there's data */}
      {(historicalData.length > 0 || forecastData.length > 0) && datasets.length > 0 && (
        <div className="h-96">
          <Line 
            key={`${historicalData.length}-${forecastData.length}`}
            data={chartData} 
            options={options} 
          />
        </div>
      )}
    </div>
  )
}

export default LineChart

