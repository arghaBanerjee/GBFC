import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/UserActions.css'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function UserActions({ user, loading, initialTab = 'upcoming' }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [pendingPayments, setPendingPayments] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')

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
      const paymentsRes = await fetch(`${API_URL}/api/user-actions/pending-payments`, {
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

  const handleAvailabilityChange = async (date, status) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/practice/${date}/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        // Update local state
        setUpcomingSessions(prev => prev.map(session => 
          session.date === date ? { ...session, user_status: status } : session
        ))
      } else {
        const err = await response.json()
        setError(err.detail || 'Failed to update availability')
      }
    } catch (err) {
      setError('Failed to update availability')
      console.error(err)
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
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming Events
          {upcomingSessions.length > 0 && (
            <span className="badge">{upcomingSessions.length}</span>
          )}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
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
        ) : activeTab === 'upcoming' ? (
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
                    <h3>Practice</h3>
                    <span className="date">{formatDate(session.date)}</span>
                  </button>
                  <div className="card-body">
                    <div className="session-details compact-details">
                      <div className="detail-chip">
                        <span className="label">Location</span>
                        <span className="value">{session.location || 'TBD'}</span>
                      </div>
                      <div className="detail-chip">
                        <span className="label">Time</span>
                        <span className="value">{session.time || 'TBD'}</span>
                      </div>
                      {session.session_cost && (
                        <div className="detail-chip">
                          <span className="label">Cost</span>
                          <span className="value">£{session.session_cost}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="availability-section">
                      <p className="section-label">Availability</p>
                      <div className="availability-buttons">
                        <button
                          className={`availability-btn available ${session.user_status === 'available' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(session.date, 'available')}
                        >
                          Available
                        </button>
                        <button
                          className={`availability-btn tentative ${session.user_status === 'tentative' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(session.date, 'tentative')}
                        >
                          Tentative
                        </button>
                        <button
                          className={`availability-btn not-available ${session.user_status === 'not_available' ? 'selected' : ''}`}
                          onClick={() => handleAvailabilityChange(session.date, 'not_available')}
                        >
                          Unavailable
                        </button>
                      </div>
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
                    <h3>Practice</h3>
                    <span className="date">{formatDate(payment.date)}</span>
                  </button>
                  <div className="card-body">
                    <div className="payment-details compact-details">
                      <div className="detail-chip">
                        <span className="label">Your Amount</span>
                        <span className="value amount">£{payment.individual_amount}</span>
                      </div>
                      <div className="detail-chip">
                        <span className="label">Pay To</span>
                        <span className="value">{payment.paid_by_name || payment.paid_by}</span>
                      </div>
                    </div>
                    
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
