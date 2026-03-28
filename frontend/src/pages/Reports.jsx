import { useState, useEffect } from 'react'
import { apiUrl } from '../api'

export default function Reports() {
  const [reportType, setReportType] = useState('booking')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const token = localStorage.getItem('token')

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)
    
    setToDate(today.toISOString().split('T')[0])
    setFromDate(thirtyDaysAgo.toISOString().split('T')[0])
  }, [])

  const handleGenerateReport = async () => {
    setError('')
    
    // Validation
    if (!fromDate || !toDate) {
      setError('Please select both from and to dates')
      return
    }
    
    const from = new Date(fromDate)
    const to = new Date(toDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (from > to) {
      setError('From date must be before or equal to To date')
      return
    }
    
    if (to > today) {
      setError('To date cannot be in the future')
      return
    }
    
    setGenerating(true)
    
    try {
      const endpoint = reportType === 'booking'
        ? `/api/reports/booking?from_date=${fromDate}&to_date=${toDate}`
        : reportType === 'expense'
          ? `/api/reports/expense?from_date=${fromDate}&to_date=${toDate}`
          : `/api/reports/player-payment?from_date=${fromDate}&to_date=${toDate}`
      
      const response = await fetch(apiUrl(endpoint), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to generate report')
      }
      
      // Get the blob from response
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = reportType === 'booking'
        ? `Booking_Report_${fromDate}_to_${toDate}.xlsx`
        : reportType === 'expense'
          ? `Expense_Report_${fromDate}_to_${toDate}.xlsx`
          : `Player_Payment_Report_${fromDate}_to_${toDate}.xlsx`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (err) {
      console.error('Error generating report:', err)
      setError(err.message || 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', color: '#1f2937' }}>
        Reports
      </h1>

      <div style={{ 
        background: 'white', 
        borderRadius: '0.5rem', 
        padding: '2rem', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
      }}>
        {/* Report Type Selection */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            color: '#374151', 
            marginBottom: '0.5rem' 
          }}>
            Report Type
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem',
              cursor: 'pointer',
              backgroundColor: 'white'
            }}
          >
            <option value="booking">Booking Report</option>
            <option value="expense">Expense Report</option>
            <option value="player-payment">Player Payment Report</option>
          </select>
        </div>

        {/* Date Range Selection */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151', 
              marginBottom: '0.5rem' 
            }}>
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151', 
              marginBottom: '0.5rem' 
            }}>
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            />
          </div>
        </div>

        {/* Report Description */}
        <div style={{ 
          background: '#f9fafb', 
          padding: '1rem', 
          borderRadius: '0.375rem', 
          marginBottom: '1.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            {reportType === 'booking' ? (
              <>
                <strong>Booking Report</strong> includes: Practice session date, time, place, total cost, and paid by user.
              </>
            ) : reportType === 'expense' ? (
              <>
                <strong>Expense Report</strong> includes: expense date, title, category, amount, paid by, payment method, description, and creation timestamp.
              </>
            ) : (
              <>
                <strong>Player Payment Report</strong> includes: Practice session date, time, place, player name, availability, 
                individual amount (for available players), payment status, and payment acknowledgement date.
              </>
            )}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{ 
            background: '#fee2e2', 
            color: '#991b1b', 
            padding: '0.75rem 1rem', 
            borderRadius: '0.375rem', 
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerateReport}
          disabled={generating}
          style={{
            width: '100%',
            padding: '0.75rem 1.5rem',
            background: generating ? '#9ca3af' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: generating ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!generating) e.target.style.background = '#059669'
          }}
          onMouseLeave={(e) => {
            if (!generating) e.target.style.background = '#10b981'
          }}
        >
          {generating ? 'Generating Report...' : 'Generate & Download Report'}
        </button>

        {/* Info Text */}
        <p style={{ 
          fontSize: '0.75rem', 
          color: '#9ca3af', 
          marginTop: '1rem', 
          textAlign: 'center' 
        }}>
          Report will be downloaded as an Excel (.xlsx) file
        </p>
      </div>
    </div>
  )
}
