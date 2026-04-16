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

  const formatDateStr = (dt) => {
    if (!dt) return null
    const date = dt instanceof Date ? dt : new Date(dt)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const parseDateStr = (dateStr) => {
    if (!dateStr) return null
    const parts = dateStr.split('-').map((p) => Number(p))
    if (parts.length !== 3) return null
    const [y, m, d] = parts
    if (!y || !m || !d) return null
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
    const rt = formatDateStr(dt)
    if (rt !== dateStr) return null
    return dt
  }

  const getCalendarEventDateTime = (dateStr, timeStr) => {
    if (!dateStr) return null
    const effectiveTime = timeStr || '21:00'
    const [year, month, day] = dateStr.split('-').map(Number)
    const [hours, minutes] = effectiveTime.split(':').map(Number)
    if (!year || !month || !day) return null
    const dt = new Date(year, month - 1, day, hours, minutes, 0, 0)
    const rt = formatDateStr(dt)
    if (rt !== dateStr) return null
    return dt
  }

  const formatGoogleCalendarDate = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
    const options = { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
    const formatter = new Intl.DateTimeFormat('en-GB', options)
    const parts = formatter.formatToParts(date)
    const year = parts.find(p => p.type === 'year').value
    const month = parts.find(p => p.type === 'month').value
    const day = parts.find(p => p.type === 'day').value
    const hour = parts.find(p => p.type === 'hour').value
    const minute = parts.find(p => p.type === 'minute').value
    return `${year}${month}${day}T${hour}${minute}00`
  }

  const buildGoogleCalendarInviteUrl = (calendarEvent) => {
    if (!calendarEvent) return ''
    const eventType = getEventTypeLabel(calendarEvent.event_type)
    const eventTitle = getEventDisplayTitle(calendarEvent)
    const title = `${eventType} - ${eventTitle}`
    const eventDateValue = calendarEvent.date || formatDateStr(new Date())
    if (!eventDateValue) return ''
    const startDateTime = getCalendarEventDateTime(eventDateValue, calendarEvent.time)
    const endDateTime = startDateTime ? new Date(startDateTime.getTime() + 60 * 60 * 1000) : null
    const eventDate = parseDateStr(eventDateValue)
    const nextEventDate = eventDate ? new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate() + 1, 12, 0, 0, 0) : null
    const dates = startDateTime && endDateTime
      ? `${formatGoogleCalendarDate(startDateTime)}/${formatGoogleCalendarDate(endDateTime)}`
      : eventDate && nextEventDate
        ? `${formatDateStr(eventDate).replace(/-/g, '')}/${formatDateStr(nextEventDate).replace(/-/g, '')}`
        : ''

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates,
      location: calendarEvent.location || 'TBD',
      details: `${title}\nDate: ${eventDateValue || 'TBD'}\nTime: ${calendarEvent.time || 'TBD'}\nLocation: ${calendarEvent.location || 'TBD'}`,
    })

    return `https://calendar.google.com/calendar/render?${params.toString()}`
  }

  const isCalendarEventPast = (dateStr, timeStr) => {
    const calendarEventDateTime = getCalendarEventDateTime(dateStr, timeStr)
    if (!calendarEventDateTime) return false
    return calendarEventDateTime.getTime() < Date.now()
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
                    
                    {(() => {
                      const googleCalendarUrl = buildGoogleCalendarInviteUrl(calendarEvent)
                      const isPast = isCalendarEventPast(calendarEvent.date, calendarEvent.time)
                      const isDisabled = !googleCalendarUrl || isPast
                      return (
                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
                          <a
                            href={isDisabled ? '#' : googleCalendarUrl}
                            target={isDisabled ? undefined : '_blank'}
                            rel={isDisabled ? undefined : 'noreferrer'}
                            aria-disabled={isDisabled}
                            onClick={(e) => {
                              if (isDisabled) e.preventDefault()
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--theme-accent-contrast)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: '600', padding: '0.4rem 0.7rem', borderRadius: '999px', border: isDisabled ? '1px solid var(--theme-border)' : '1px solid var(--theme-accent)', background: isDisabled ? 'var(--theme-text-muted)' : 'var(--theme-accent)', boxShadow: isDisabled ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 4px 10px color-mix(in srgb, var(--theme-accent) 22%, transparent)', opacity: isDisabled ? 0.65 : 1, pointerEvents: isDisabled ? 'none' : 'auto', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                          >
                            <span style={{ width: '0.95rem', height: '0.95rem', borderRadius: '0.25rem', background: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)', flex: '0 0 auto' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <rect x="3" y="4" width="18" height="17" rx="3" fill="#ffffff" stroke="#DADCE0"/>
                                <path d="M8 2.75C8.41421 2.75 8.75 3.08579 8.75 3.5V6C8.75 6.41421 8.41421 6.75 8 6.75C7.58579 6.75 7.25 6.41421 7.25 6V3.5C7.25 3.08579 7.58579 2.75 8 2.75Z" fill="#4285F4"/>
                                <path d="M16 2.75C16.4142 2.75 16.75 3.08579 16.75 3.5V6C16.75 6.41421 16.4142 6.75 16 6.75C15.5858 6.75 15.25 6.41421 15.25 6V3.5C15.25 3.08579 15.5858 2.75 16 2.75Z" fill="#34A853"/>
                                <path d="M3.5 8.5H20.5" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </span>
                            <span>Add to Calendar</span>
                          </a>
                        </div>
                      )
                    })()}
                    
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
