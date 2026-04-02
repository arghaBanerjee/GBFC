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

  const eventTypeLabelMap = {
    practice: 'Practice',
    match: 'Match',
    social: 'Social',
    others: 'Other',
  }
  
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

  const handleAvailabilityChange = async (sessionId, status) => {
    if (updatingAvailabilityDates[sessionId]) return

    let previousSessions = upcomingSessions

    try {
      const token = localStorage.getItem('token')
      const currentSession = upcomingSessions.find((session) => session.id === sessionId)
      const currentStatus = currentSession?.user_status
      const newStatus = currentStatus === status ? 'none' : status
      previousSessions = upcomingSessions
      setError('')
      setUpdatingAvailabilityDates(prev => ({ ...prev, [sessionId]: true }))

      setUpcomingSessions(prev => prev.map(session => {
        if (session.id !== sessionId) return session

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

      const response = await fetch(`${API_URL}/api/practice/sessions/id/${sessionId}/availability`, {
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
      setUpdatingAvailabilityDates(prev => ({ ...prev, [sessionId]: false }))
    }
  }

  const handlePaymentConfirmation = async (sessionId, paid) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/practice/sessions/id/${sessionId}/payment`, {
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

  const getEventTypeLabel = (eventType) => eventTypeLabelMap[eventType] || 'Event'

  const getEventDisplayTitle = (item) => {
    const title = item?.event_title?.trim()
    return title || getEventTypeLabel(item?.event_type)
  }

  const navigateToPracticeDate = (date, sessionId) => {
    const params = new URLSearchParams()
    params.set('date', date)
    if (sessionId != null) {
      params.set('sessionId', String(sessionId))
    }
    navigate(`/calendar?${params.toString()}`)
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
              <p className="empty-message">No upcoming events</p>
            ) : (
              upcomingSessions.map(session => (
                <div key={session.id} className="session-card">
                  <button
                    type="button"
                    className="card-header clickable-card-header"
                    onClick={() => navigateToPracticeDate(session.date, session.id)}
                  >
                    <div className="card-header-main">
                      <h3>{getEventTypeLabel(session.event_type)}&nbsp;</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--theme-text-muted)' }}>{getEventDisplayTitle(session)}</p>
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
                      <p style={{ marginBottom: '0.5rem', fontSize: '0.8125rem', color: session.capacity_reached ? 'var(--theme-warning-strong, color-mix(in srgb, var(--theme-warning) 84%, black 16%))' : 'var(--theme-accent-strong)' }}>
                        Capacity: {session.available_count || 0}/{session.maximum_capacity || 100} booked
                        {session.remaining_slots > 0 ? ` · ${session.remaining_slots} slot${session.remaining_slots === 1 ? '' : 's'} left` : ' · Full'}
                      </p>
                      <div className="availability-buttons">
                        <button
                          className={`availability-btn available ${session.user_status === 'available' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(session.id, 'available')}
                          disabled={updatingAvailabilityDates[session.id] || (session.capacity_reached && session.user_status !== 'available')}
                        >
                          {updatingAvailabilityDates[session.id] && session.user_status === 'available' ? 'Updating...' : 'Available'}
                        </button>
                        <button
                          className={`availability-btn tentative ${session.user_status === 'tentative' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(session.id, 'tentative')}
                          disabled={updatingAvailabilityDates[session.id]}
                        >
                          {updatingAvailabilityDates[session.id] && session.user_status === 'tentative' ? 'Updating...' : 'Tentative'}
                        </button>
                        <button
                          className={`availability-btn not-available ${session.user_status === 'not_available' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(session.id, 'not_available')}
                          disabled={updatingAvailabilityDates[session.id]}
                        >
                          {updatingAvailabilityDates[session.id] && session.user_status === 'not_available' ? 'Updating...' : 'Unavailable'}
                        </button>
                      </div>
                      {session.capacity_reached && session.user_status !== 'available' && (
                        <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--theme-warning-strong, color-mix(in srgb, var(--theme-warning) 84%, black 16%))' }}>
                          Full capacity. No Availability until a slot opens.
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
                <div key={payment.id} className="payment-card">
                  <button
                    type="button"
                    className="card-header clickable-card-header"
                    onClick={() => navigateToPracticeDate(payment.date, payment.id)}
                  >
                    <div className="card-header-main">
                      <h3>{getEventTypeLabel(payment.event_type)}&nbsp;</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--theme-text-muted)' }}>{getEventDisplayTitle(payment)}</p>
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
                      <div className="detail-chip">
                        <span className="label">Your Amount</span>
                        <span className="value amount">£{payment.individual_amount}</span>
                      </div>
                      <div className="detail-chip">
                        <span className="label">Pay To</span>
                        <span className="value">{payment.paid_by_name || payment.paid_by}</span>
                      </div>
                    </div>
                    {payment.paid_by_bank_name && payment.paid_by_sort_code && payment.paid_by_account_number && (
                      <div className="payment-detail-block">
                        <div className="payment-detail-block-title">
                          Bank Details
                        </div>
                        <div className="payment-detail-block-grid">
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
                          onChange={(e) => handlePaymentConfirmation(payment.id, e.target.checked)}
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
