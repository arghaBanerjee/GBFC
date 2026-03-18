import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../styles/UserActions.css'
import { validateUserActionsTab } from '../utils/routeValidation'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function UserActions({ user, loading }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [pendingPayments, setPendingPayments] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [updatingAvailabilityDates, setUpdatingAvailabilityDates] = useState({})
  
  // Validate route tab and redirect if invalid
  const pathTab = location.pathname.split('/').pop()
  const validatedTab = validateUserActionsTab(pathTab)
  const activeTab = validatedTab
  
  useEffect(() => {
    if (pathTab !== validatedTab) {
      navigate(`/user-actions/${validatedTab}`, { replace: true })
    }
  }, [pathTab, validatedTab, navigate])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    setLoadingData(true)
    setError('')
    
    try {
      const token = localStorage.getItem('token')
      
      if (!token) {
        setError('Please log in to view your actions')
        setLoadingData(false)
        return
      }
      
      // Fetch upcoming sessions
      const upcomingRes = await fetch(`${API_URL}/api/user-actions/upcoming-sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (upcomingRes.ok) {
        const upcomingData = await upcomingRes.json()
        setUpcomingSessions(upcomingData.sessions || [])
      } else {
        if (upcomingRes.status === 401) {
          setError('Session expired. Please log in again.')
        } else {
          try {
            const errorData = await upcomingRes.json()
            console.error('Failed to fetch upcoming sessions:', errorData)
            setError(errorData.detail || 'Failed to load upcoming sessions')
          } catch (e) {
            console.error('Failed to parse error response:', e)
            setError(`Failed to load upcoming sessions (Status: ${upcomingRes.status})`)
          }
        }
        setLoadingData(false)
        return
      }
      
      // Fetch pending payments
      const paymentsRes = await fetch(`${API_URL}/api/user-actions/payments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json()
        setPendingPayments(paymentsData.payments || [])
      } else {
        if (paymentsRes.status === 401) {
          setError('Session expired. Please log in again.')
        } else {
          try {
            const errorData = await paymentsRes.json()
            console.error('Failed to fetch pending payments:', errorData)
            setError(errorData.detail || 'Failed to load pending payments')
          } catch (e) {
            console.error('Failed to parse error response:', e)
            setError(`Failed to load pending payments (Status: ${paymentsRes.status})`)
          }
        }
        setLoadingData(false)
        return
      }
    } catch (err) {
      setError('Failed to load data: ' + err.message)
      console.error(err)
    } finally {
      setLoadingData(false)
    }
  }

  const refreshUpcomingSessions = async () => {
    const token = localStorage.getItem('token')
    if (!token) return

    const upcomingRes = await fetch(`${API_URL}/api/user-actions/upcoming-sessions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (upcomingRes.ok) {
      const upcomingData = await upcomingRes.json()
      setUpcomingSessions(upcomingData.sessions || [])
    }
  }

  const handleAvailabilityChange = async (date, status) => {
    if (updatingAvailabilityDates[date]) return

    let previousSessions = upcomingSessions

    try {
      const token = localStorage.getItem('token')
      const currentStatus = upcomingSessions.find((session) => session.date === date)?.user_status
      const newStatus = currentStatus === status ? 'none' : status
      previousSessions = upcomingSessions
      setError('')
      setUpdatingAvailabilityDates(prev => ({ ...prev, [date]: true }))

      setUpcomingSessions(prev => prev.map(session => {
        if (session.date !== date) return session

        const previousWasAvailable = session.user_status === 'available'
        const nextIsAvailable = newStatus === 'available'
        const availableCount = (session.available_count || 0) + (nextIsAvailable ? 1 : 0) - (previousWasAvailable ? 1 : 0)
        const maximumCapacity = session.maximum_capacity || 100

        return {
          ...session,
          user_status: newStatus === 'none' ? null : newStatus,
          available_count: availableCount,
          remaining_slots: Math.max(maximumCapacity - availableCount, 0),
          capacity_reached: availableCount >= maximumCapacity,
        }
      }))

      const response = await fetch(`${API_URL}/api/practice/${date}/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        await refreshUpcomingSessions()
      } else {
        const err = await response.json()
        setUpcomingSessions(previousSessions)
        setError(err.detail || 'Failed to update availability')
      }
    } catch (err) {
      setUpcomingSessions(previousSessions)
      setError('Failed to update availability')
      console.error(err)
    } finally {
      setUpdatingAvailabilityDates(prev => ({ ...prev, [date]: false }))
    }
  }

  const handlePaymentConfirmation = async (date, paid) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/practice/${date}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paid })
      })

      if (response.ok) {
        // Refresh pending payments list
        fetchData()
      } else {
        const err = await response.json()
        setError(err.detail || 'Failed to update payment')
      }
    } catch (err) {
      setError('Failed to update payment')
      console.error(err)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const navigateToPracticeDate = (date) => {
    navigate(`/book-practice?date=${date}`)
  }

  if (loading || !user) {
    return <div className="user-actions-container"><p>Loading...</p></div>
  }

  return (
    <div className="user-actions-container">
      <h1>My Actions</h1>

      {error && (
        <div style={{ 
          padding: '1rem', 
          marginBottom: '1rem', 
          backgroundColor: '#fee', 
          color: '#c00', 
          borderRadius: '0.375rem' 
        }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => navigate('/user-actions/events')}
        >
          Upcoming Events
          {upcomingSessions.length > 0 && (
            <span className="badge">{upcomingSessions.length}</span>
          )}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => navigate('/user-actions/payments')}
        >
          Pending Payments
          {pendingPayments.length > 0 && (
            <span className="badge">{pendingPayments.length}</span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {loadingData ? (
          <p>Loading...</p>
        ) : activeTab === 'events' ? (
          <div className="upcoming-sessions">
            {upcomingSessions.length === 0 ? (
              <p className="empty-message">No upcoming practice sessions</p>
            ) : (
              upcomingSessions.map(session => (
                <div key={session.date} className="session-card">
                  <button
                    type="button"
                    className="card-header clickable-card-header"
                    onClick={() => navigateToPracticeDate(session.date)}
                  >
                    <div className="card-header-main">
                      <h3>Practice</h3>
                    </div>
                    <div className="card-header-meta">
                      <span className="card-header-cta">View details →</span>
                    </div>
                  </button>
                  <div className="card-body">
                    <div className="session-details compact-details">
                      <div className="detail-chip">
                        <span className="label">Location</span>
                        <span className="value">{session.location || 'TBD'}</span>
                      </div>
                      <div className="detail-chip">
                        <span className="label">Date & Time</span>
                        <span className="value">{`${formatDate(session.date)}${session.time ? `, ${session.time}` : ', TBD'}`}</span>
                      </div>
                    </div>
                    
                    <div className="availability-section">
                      <p className="section-label">Availability</p>
                      <p style={{ marginBottom: '0.5rem', fontSize: '0.8125rem', color: session.capacity_reached ? '#92400e' : '#166534' }}>
                        Capacity: {session.available_count || 0}/{session.maximum_capacity || 100} available
                        {session.remaining_slots > 0 ? ` · ${session.remaining_slots} slot${session.remaining_slots === 1 ? '' : 's'} left` : ' · Full'}
                      </p>
                      <div className="availability-buttons">
                        <button
                          className={`availability-btn available ${session.user_status === 'available' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(session.date, 'available')}
                          disabled={updatingAvailabilityDates[session.date] || (session.capacity_reached && session.user_status !== 'available')}
                        >
                          {updatingAvailabilityDates[session.date] && session.user_status === 'available' ? 'Updating...' : 'Available'}
                        </button>
                        <button
                          className={`availability-btn tentative ${session.user_status === 'tentative' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(session.date, 'tentative')}
                          disabled={updatingAvailabilityDates[session.date]}
                        >
                          {updatingAvailabilityDates[session.date] && session.user_status === 'tentative' ? 'Updating...' : 'Tentative'}
                        </button>
                        <button
                          className={`availability-btn not-available ${session.user_status === 'not_available' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(session.date, 'not_available')}
                          disabled={updatingAvailabilityDates[session.date]}
                        >
                          {updatingAvailabilityDates[session.date] && session.user_status === 'not_available' ? 'Updating...' : 'Unavailable'}
                        </button>
                      </div>
                      {session.capacity_reached && session.user_status !== 'available' && (
                        <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#92400e' }}>
                          Maximum capacity reached. Available is disabled until a slot opens up.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="pending-payments">
            {pendingPayments.length === 0 ? (
              <p className="empty-message">No pending payments</p>
            ) : (
              pendingPayments.map(payment => (
                <div key={payment.date} className="payment-card">
                  <button
                    type="button"
                    className="card-header clickable-card-header"
                    onClick={() => navigateToPracticeDate(payment.date)}
                  >
                    <div className="card-header-main">
                      <h3>Practice</h3>
                    </div>
                    <div className="card-header-meta">
                      <span className="card-header-cta">View details →</span>
                    </div>
                  </button>
                  <div className="card-body">
                    <div className="payment-details compact-details">
                      <div className="detail-chip">
                        <span className="label">Date & Time</span>
                        <span className="value">{`${formatDate(payment.date)}${payment.time ? `, ${payment.time}` : ''}`}</span>
                      </div>
                      <div className="detail-chip" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <span className="label">Your Amount</span>
                        <span className="value amount">£{payment.individual_amount}</span>
                      </div>
                      <div className="detail-chip" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <span className="label">Pay To</span>
                        <span className="value">{payment.paid_by_name || payment.paid_by}</span>
                      </div>
                    </div>
                    {payment.paid_by_bank_name && payment.paid_by_sort_code && payment.paid_by_account_number && (
                      <div style={{
                        marginTop: '0.875rem',
                        marginBottom: '0.875rem',
                        padding: '0.75rem',
                        borderRadius: '0.75rem',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0'
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Bank Details
                        </div>
                        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem', color: '#334155' }}>
                          <div><strong>Bank Name:</strong> {payment.paid_by_bank_name}</div>
                          <div><strong>Sort Code:</strong> {payment.paid_by_sort_code}</div>
                          <div><strong>Account Number:</strong> {payment.paid_by_account_number}</div>
                        </div>
                      </div>
                    )}
                    
                    <div className="payment-confirmation">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={payment.paid}
                          onChange={(e) => handlePaymentConfirmation(payment.date, e.target.checked)}
                        />
                        <span>Paid £{payment.individual_amount} to {payment.paid_by_name || payment.paid_by}</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserActions
