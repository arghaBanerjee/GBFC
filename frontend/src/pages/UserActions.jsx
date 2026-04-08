import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../styles/UserActions.css'
import { validateUserActionsTab } from '../utils/routeValidation'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function UserActions({ user, loading }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [upcomingCalendarEvents, setUpcomingCalendarEvents] = useState([])
  const [pendingPayments, setPendingPayments] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const hasLoadedData = useRef(false)
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
      navigate(`/user/${validatedTab}`, { replace: true })
    }
  }, [pathTab, validatedTab, navigate])

  useEffect(() => {
    if (user && !hasLoadedData.current) {
      hasLoadedData.current = true
      fetchData()
    }
  }, [user])

  useEffect(() => {
    // Reset data loading state when user logs out
    if (!user) {
      hasLoadedData.current = false
      setUpcomingCalendarEvents([])
      setPendingPayments([])
      setError('')
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
      const upcomingRes = await fetch(`${API_URL}/api/user/upcoming-sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (upcomingRes.ok) {
        const upcomingData = await upcomingRes.json()
        setUpcomingCalendarEvents(upcomingData.sessions || [])
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
      const paymentsRes = await fetch(`${API_URL}/api/user/payments`, {
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

  const refreshUpcomingCalendarEvents = async () => {
    const token = localStorage.getItem('token')
    if (!token) return

    const upcomingRes = await fetch(`${API_URL}/api/user/upcoming-sessions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (upcomingRes.ok) {
      const upcomingData = await upcomingRes.json()
      setUpcomingCalendarEvents(upcomingData.sessions || [])
    }
  }

  const refreshPendingPayments = async () => {
    const token = localStorage.getItem('token')
    if (!token) return

    const paymentsRes = await fetch(`${API_URL}/api/user/payments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (paymentsRes.ok) {
      const paymentsData = await paymentsRes.json()
      setPendingPayments(paymentsData.payments || [])
    }
  }

  const handleAvailabilityChange = async (sessionId, status) => {
    if (updatingAvailabilityDates[sessionId]) return

    let previousCalendarEvents = upcomingCalendarEvents

    try {
      const token = localStorage.getItem('token')
      const currentCalendarEvent = upcomingCalendarEvents.find((calendarEvent) => calendarEvent.id === sessionId)
      const currentStatus = currentCalendarEvent?.user_status
      const newStatus = currentStatus === status ? 'none' : status
      previousCalendarEvents = upcomingCalendarEvents
      setError('')
      setUpdatingAvailabilityDates(prev => ({ ...prev, [sessionId]: true }))

      setUpcomingCalendarEvents(prev => prev.map(calendarEvent => {
        if (calendarEvent.id !== sessionId) return calendarEvent

        const previousWasAvailable = calendarEvent.user_status === 'available'
        const nextIsAvailable = newStatus === 'available'
        const availableCount = (calendarEvent.available_count || 0) + (nextIsAvailable ? 1 : 0) - (previousWasAvailable ? 1 : 0)
        const maximumCapacity = calendarEvent.maximum_capacity || 100

        return {
          ...calendarEvent,
          user_status: newStatus === 'none' ? null : newStatus,
          available_count: availableCount,
          remaining_slots: Math.max(maximumCapacity - availableCount, 0),
          capacity_reached: availableCount >= maximumCapacity,
        }
      }))

      const response = await fetch(`${API_URL}/api/calendar/events/id/${sessionId}/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        await refreshUpcomingCalendarEvents()
      } else {
        const err = await response.json()
        setUpcomingCalendarEvents(previousCalendarEvents)
        setError(err.detail || 'Failed to update availability')
      }
    } catch (err) {
      setUpcomingCalendarEvents(previousCalendarEvents)
      setError('Failed to update availability')
      console.error(err)
    } finally {
      setUpdatingAvailabilityDates(prev => ({ ...prev, [sessionId]: false }))
    }
  }

  const handlePaymentConfirmation = async (sessionId, paid) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/calendar/events/id/${sessionId}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paid })
      })

      if (response.ok) {
        // Refresh pending payments list only
        refreshPendingPayments()
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

  const navigateToCalendarEvent = (date, sessionId) => {
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
          onClick={() => navigate('/user/events')}
        >
          Upcoming Events
          {upcomingCalendarEvents.length > 0 && (
            <span className="badge">{upcomingCalendarEvents.length}</span>
          )}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => navigate('/user/payments')}
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
          <div className="upcoming-calendar-events">
            {upcomingCalendarEvents.length === 0 ? (
              <p className="empty-message">No upcoming events</p>
            ) : (
              upcomingCalendarEvents.map(calendarEvent => (
                <div key={calendarEvent.id} className="calendar-event-card">
                  <button
                    type="button"
                    className="card-header clickable-card-header"
                    onClick={() => navigateToCalendarEvent(calendarEvent.date, calendarEvent.id)}
                    style={{
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <div className="card-header-main">
                      <h3>{getEventTypeLabel(calendarEvent.event_type)}&nbsp;</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: 'var(--theme-text-muted)' }}>{getEventDisplayTitle(calendarEvent)}</p>
                    </div>
                    <div className="card-header-meta">
                      <span className="card-header-cta">View details</span>
                    </div>
                  </button>
                  <div className="card-body">
                    <div className="calendar-event-details compact-details">
                      <div className="detail-chip">
                        <span className="label">Location</span>
                        <span className="value">{calendarEvent.location || 'TBD'}</span>
                      </div>
                      <div className="detail-chip">
                        <span className="label">Date & Time</span>
                        <span className="value">{`${formatDate(calendarEvent.date)}${calendarEvent.time ? `, ${calendarEvent.time}` : ', TBD'}`}</span>
                      </div>
                    </div>
                    
                    <div className="availability-section">
                      <p className="section-label">Availability</p>
                      <p style={{ marginBottom: '0.5rem', fontSize: '0.8125rem', color: calendarEvent.capacity_reached ? 'var(--theme-warning-strong, color-mix(in srgb, var(--theme-warning) 84%, black 16%))' : 'var(--theme-accent-strong)' }}>
                        Capacity: {calendarEvent.available_count || 0}/{calendarEvent.maximum_capacity || 100} booked
                        {calendarEvent.remaining_slots > 0 ? ` · ${calendarEvent.remaining_slots} slot${calendarEvent.remaining_slots === 1 ? '' : 's'} available` : ' · Full'}
                      </p>
                      <div className="availability-buttons">
                        <button
                          className={`availability-btn available ${calendarEvent.user_status === 'available' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(calendarEvent.id, 'available')}
                          disabled={updatingAvailabilityDates[calendarEvent.id] || (calendarEvent.capacity_reached && calendarEvent.user_status !== 'available')}
                        >
                          {updatingAvailabilityDates[calendarEvent.id] && calendarEvent.user_status === 'available' ? 'Updating...' : 'Available'}
                        </button>
                        <button
                          className={`availability-btn tentative ${calendarEvent.user_status === 'tentative' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(calendarEvent.id, 'tentative')}
                          disabled={updatingAvailabilityDates[calendarEvent.id]}
                        >
                          {updatingAvailabilityDates[calendarEvent.id] && calendarEvent.user_status === 'tentative' ? 'Updating...' : 'Tentative'}
                        </button>
                        <button
                          className={`availability-btn not-available ${calendarEvent.user_status === 'not_available' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(calendarEvent.id, 'not_available')}
                          disabled={updatingAvailabilityDates[calendarEvent.id]}
                        >
                          {updatingAvailabilityDates[calendarEvent.id] && calendarEvent.user_status === 'not_available' ? 'Updating...' : 'Not Available'}
                        </button>
                      </div>
                      {calendarEvent.capacity_reached && calendarEvent.user_status !== 'available' && (
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
                    onClick={() => navigateToCalendarEvent(payment.date, payment.id)}
                    style={{
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
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
