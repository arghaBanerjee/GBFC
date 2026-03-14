import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiUrl } from '../api'

export default function Practice({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [availability, setAvailability] = useState({})
  const [adminSessions, setAdminSessions] = useState([])
  const [matches, setMatches] = useState([])
  const [voteSummary, setVoteSummary] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedUserEmail, setSelectedUserEmail] = useState('')
  const [adminSelectedStatus, setAdminSelectedStatus] = useState('available')
  const token = localStorage.getItem('token')

  const parseDateStr = (dateStr) => {
    if (!dateStr) return null
    // Expect YYYY-MM-DD
    const parts = dateStr.split('-').map((p) => Number(p))
    if (parts.length !== 3) return null
    const [y, m, d] = parts
    if (!y || !m || !d) return null
    const dt = new Date(y, m - 1, d)
    // Validate round-trip
    const rt = dt.toISOString().split('T')[0]
    if (rt !== dateStr) return null
    return dt
  }

  const formatDateStr = (dt) => dt.toISOString().split('T')[0]

  // Sync from URL -> selected date
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const dateStr = params.get('date')
    const dt = parseDateStr(dateStr)
    if (!dt) return

    const currentSelected = selectedDate ? formatDateStr(selectedDate) : null
    if (currentSelected === dateStr) return

    setSelectedDate(dt)
    setCurrentDate(new Date(dt.getFullYear(), dt.getMonth(), 1))
  }, [location.search])

  useEffect(() => {
    // Fetch admin-created practice sessions
    fetch(apiUrl('/api/practice/sessions'))
      .then(r => r.json())
      .then(data => setAdminSessions(data || []))
    
    // Fetch matches/events to highlight on calendar
    fetch(apiUrl('/api/events'))
      .then(r => r.json())
      .then(data => setMatches(data || []))
      .catch(() => setMatches([]))
    // Fetch user availability
    if (user && token) {
      fetch(apiUrl('/api/practice/availability'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(r => r.json())
        .then(data => setAvailability(data || {}))
      
      // Check if user is admin
      fetch(apiUrl('/api/me'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(r => r.json())
        .then(data => {
          setIsAdmin(data.user_type === 'admin')
        })
      
      // Fetch all users for admin dropdown
      fetch(apiUrl('/api/users'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(r => r.json())
        .then(data => setAllUsers(data || []))
        .catch(() => setAllUsers([]))
    } else {
      setAvailability({})
      setIsAdmin(false)
      setAllUsers([])
    }
  }, [user])

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = monthStart.getDay()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDate(null)
  }

  const handleDateClick = (day) => {
    const clicked = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), day))
    setSelectedDate(clicked)

    const dateStr = formatDateStr(clicked)
    const params = new URLSearchParams(location.search)
    params.set('date', dateStr)
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false })
  }

  const handleAvailability = (status) => {
    if (!user) return
    
    const dateStr = selectedDate.toISOString().split('T')[0]
    const currentStatus = availability[dateStr]
    
    // Toggle: if clicking the same button, deselect (remove availability)
    const isDeselecting = currentStatus === status
    const newStatus = isDeselecting ? 'none' : status
    
    fetch(apiUrl(`/api/practice/availability`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date: dateStr, status: newStatus }),
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to set availability')
          })
        }
        return r.json()
      })
      .then(data => {
        // Update local state: remove if deselecting, otherwise set new status
        if (isDeselecting) {
          setAvailability(prev => {
            const updated = { ...prev }
            delete updated[dateStr]
            return updated
          })
        } else {
          setAvailability(prev => ({ ...prev, [dateStr]: newStatus }))
        }
        // Refresh vote summary so UI table updates immediately
        return fetch(apiUrl(`/api/practice/availability/${dateStr}`))
          .then(r => r.json())
          .then(setVoteSummary)
      })
      .catch(err => {
        alert(err.message)
      })
  }

  const handleAdminSetAvailability = () => {
    if (!selectedUserEmail) {
      alert('Please select a user')
      return
    }
    
    fetch(apiUrl('/api/admin/practice/availability'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: selectedDate.toISOString().split('T')[0],
        user_email: selectedUserEmail,
        status: adminSelectedStatus,
      }),
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to set availability')
          })
        }
        return r.json()
      })
      .then(() => {
        // Refresh vote summary
        return fetch(apiUrl(`/api/practice/availability/${selectedDate.toISOString().split('T')[0]}`))
          .then(r => r.json())
          .then(setVoteSummary)
      })
      .then(() => {
        setSelectedUserEmail('')
        alert('Availability updated successfully')
      })
      .catch(err => {
        alert(err.message)
      })
  }

  const handleAdminDeleteAvailability = (userEmail) => {
    if (!confirm('Are you sure you want to remove this user\'s availability?')) {
      return
    }
    
    fetch(apiUrl('/api/admin/practice/availability'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: selectedDate.toISOString().split('T')[0],
        user_email: userEmail,
        status: 'delete',
      }),
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to delete availability')
          })
        }
        return r.json()
      })
      .then(() => {
        // Refresh vote summary
        return fetch(apiUrl(`/api/practice/availability/${selectedDate.toISOString().split('T')[0]}`))
          .then(r => r.json())
          .then(setVoteSummary)
      })
      .catch(err => {
        alert(err.message)
      })
  }

  const voteBtnStyle = (btnStatus) => {
    const isActive = selectedStatus === btnStatus
    
    // Color-coded highlighting: green for available, yellow for tentative, red for unavailable
    let activeColor, activeBg, activeBorder
    if (btnStatus === 'available') {
      activeColor = '#166534' // dark green text
      activeBg = '#dcfce7' // light green background
      activeBorder = '#16a34a' // green border
    } else if (btnStatus === 'tentative') {
      activeColor = '#854d0e' // dark yellow text
      activeBg = '#fef9c3' // light yellow background
      activeBorder = '#eab308' // yellow border
    } else { // not_available
      activeColor = '#991b1b' // dark red text
      activeBg = '#fee2e2' // light red background
      activeBorder = '#dc2626' // red border
    }
    
    return {
      marginRight: btnStatus !== 'not_available' ? '0.5rem' : undefined,
      padding: '0.5rem 0.75rem',
      borderRadius: '0.375rem',
      border: isActive ? `2px solid ${activeBorder}` : '1px solid #d1d5db',
      background: isActive ? activeBg : '#ffffff',
      color: isActive ? activeColor : '#374151',
      fontWeight: isActive ? 700 : 400,
      cursor: user ? 'pointer' : 'not-allowed',
      opacity: user ? 1 : 0.6,
    }
  }

  const renderCalendar = () => {
    const blanks = Array(firstDayOfWeek).fill(null)
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    const calendar = [...blanks, ...days]

    return calendar.map((day, index) => {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const isThursday = day && new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay() === 4
      const isAdminSession = adminSessions.some(s => s.date === dateStr)
      const hasMatch = matches.some(m => m.date === dateStr)
      const isSelected = Boolean(day) && selectedDate?.toISOString().split('T')[0] === dateStr

      let backgroundColor = '#ffffff'
      if (hasMatch) backgroundColor = '#bfdbfe' // Light blue for match days
      else if (isAdminSession) backgroundColor = '#86efac' // Green for any day with practice session
      else if (isThursday) backgroundColor = '#f0fdf4' // Light green for Thursdays without session

      return (
        <div
          key={`cal-${index}`}
          onClick={() => day && handleDateClick(day)}
          style={{
            border: isSelected ? '3px solid #3b82f6' : '1px solid #e5e7eb',
            padding: '0.5rem',
            margin: '2px',
            minHeight: '40px',
            backgroundColor,
            cursor: day ? 'pointer' : 'default',
            borderRadius: '4px',
            boxShadow: isSelected ? '0 0 0 3px rgba(59, 130, 246, 0.3)' : 'none',
            transform: isSelected ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.2s ease',
            fontWeight: isSelected ? '700' : '400',
          }}
        >
          {day}
        </div>
      )
    })
  }

  const selectedSession = adminSessions.find(s => s.date === selectedDate?.toISOString().split('T')[0])
  const selectedMatch = matches.find(m => m.date === selectedDate?.toISOString().split('T')[0])
  const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : null
  const selectedStatus = selectedDateStr ? availability[selectedDateStr] : null

  useEffect(() => {
    if (!selectedDateStr) {
      setVoteSummary(null)
      return
    }
    fetch(apiUrl(`/api/practice/availability/${selectedDateStr}`))
      .then(r => r.json())
      .then(setVoteSummary)
      .catch(() => setVoteSummary(null))
  }, [selectedDateStr])

  return (
    <div className="container">
      <h2>Book Practice</h2>
      <p style={{ marginBottom: '1rem', color: '#6b7280' }}>Click on a date to select your availability</p>
      
      {/* Color Legend */}
      <div style={{ 
        marginBottom: '1rem', 
        padding: '0.75rem', 
        background: '#f9fafb', 
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#86efac', borderRadius: '4px', border: '1px solid #e5e7eb' }}></div>
            <span>Practice Session</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#bfdbfe', borderRadius: '4px', border: '1px solid #e5e7eb' }}></div>
            <span>Football Match</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={handlePrevMonth}>&lt;</button>
        <h3>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={handleNextMonth}>&gt;</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '1rem' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 'bold' }}>{d}</div>
        ))}
        {renderCalendar()}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}>
          <h4>{selectedDate.toLocaleDateString()}</h4>
          
          {/* Show match details if there's a match on this date */}
          {selectedMatch ? (
            <div style={{ 
              padding: '1rem', 
              background: '#dbeafe', 
              borderRadius: '0.5rem', 
              border: '1px solid #93c5fd',
              marginTop: '0.75rem'
            }}>
              <p style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
                <strong>⚽ Football Match</strong>
              </p>
              <p style={{ marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '600' }}>
                {selectedMatch.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <span>Time: {selectedMatch.time || 'TBD'}</span>
              </div>
              <p style={{ 
                marginTop: '0.75rem', 
                padding: '0.75rem', 
                background: '#fff', 
                borderRadius: '0.375rem',
                color: '#1e40af',
                fontWeight: '500'
              }}>
                ℹ️ There will be no practice session on this date as there is a football match already planned.
              </p>
            </div>
          ) : selectedSession ? (
            <div>
              <p style={{ marginBottom: '0.75rem' }}>
                <strong>Practice Session</strong>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <span>Time: {selectedSession.time || 'TBD'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>Location: {selectedSession.location || 'TBD'}</span>
              </div>
            </div>
          ) : (
            <p>
              No practice session on this date. Please select a date highlighted in green to book your practice.<br />
              {user && selectedStatus && `Your status: ${selectedStatus}`}
              {!user && 'Log in to set your availability'}
            </p>
          )}
          {selectedSession && !selectedMatch && (
            <>
              <div style={{ marginTop: '1rem' }}>
                <strong>Your Selection</strong>
                <div style={{ marginTop: '0.5rem' }}>
                  <button onClick={() => handleAvailability('available')} style={voteBtnStyle('available')} disabled={!user}>Available</button>
                  <button onClick={() => handleAvailability('tentative')} style={voteBtnStyle('tentative')} disabled={!user}>Tentative</button>
                  <button onClick={() => handleAvailability('not_available')} style={voteBtnStyle('not_available')} disabled={!user}>Unavailable</button>
                </div>
                {!user && <p style={{ marginTop: '0.5rem', color: '#dc2626' }}>Log in to vote your availability.</p>}
              </div>

              {isAdmin && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                  <strong style={{ color: '#7c3aed' }}>Admin Controls</strong>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={selectedUserEmail}
                      onChange={(e) => setSelectedUserEmail(e.target.value)}
                      style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', flex: '1', minWidth: '200px' }}
                    >
                      <option value="">Select a user...</option>
                      {allUsers.map((u) => (
                        <option key={u.email} value={u.email}>
                          {u.full_name} ({u.email})
                        </option>
                      ))}
                    </select>
                    <select
                      value={adminSelectedStatus}
                      onChange={(e) => setAdminSelectedStatus(e.target.value)}
                      style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                    >
                      <option value="available">Available</option>
                      <option value="tentative">Tentative</option>
                      <option value="not_available">Unavailable</option>
                    </select>
                    <button
                      onClick={handleAdminSetAvailability}
                      style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Set Availability
                    </button>
                  </div>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    As admin, you can add or modify any user's availability for this practice session.
                  </p>
                </div>
              )}

              <div style={{ marginTop: '1rem' }}>
                <strong>Member Availability</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '0.75rem' }}>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.75rem', background: '#f0fdf4' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Available</div>
                    {(voteSummary?.available || []).length > 0 && (
                      <div style={{ fontSize: '0.875rem', color: '#16a34a', fontWeight: '600', marginBottom: '0.5rem' }}>({(voteSummary?.available || []).length})</div>
                    )}
                    <div style={{ marginTop: '0.5rem' }}>
                      {(voteSummary?.available || []).map((n, idx) => (
                        <div key={`${n}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span>{n.split(' ')[0]}</span>
                          {isAdmin && (
                            <button
                              onClick={() => handleAdminDeleteAvailability(voteSummary?.user_emails?.[n] || n)}
                              style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                              title="Remove"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.75rem', background: '#fffbeb' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Tentative</div>
                    {(voteSummary?.tentative || []).length > 0 && (
                      <div style={{ fontSize: '0.875rem', color: '#eab308', fontWeight: '600', marginBottom: '0.5rem' }}>({(voteSummary?.tentative || []).length})</div>
                    )}
                    <div style={{ marginTop: '0.5rem' }}>
                      {(voteSummary?.tentative || []).map((n, idx) => (
                        <div key={`${n}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span>{n.split(' ')[0]}</span>
                          {isAdmin && (
                            <button
                              onClick={() => handleAdminDeleteAvailability(voteSummary?.user_emails?.[n] || n)}
                              style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                              title="Remove"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.75rem', background: '#fef2f2' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Unavailable</div>
                    {(voteSummary?.not_available || []).length > 0 && (
                      <div style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: '600', marginBottom: '0.5rem' }}>({(voteSummary?.not_available || []).length})</div>
                    )}
                    <div style={{ marginTop: '0.5rem' }}>
                      {(voteSummary?.not_available || []).map((n, idx) => (
                        <div key={`${n}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span>{n.split(' ')[0]}</span>
                          {isAdmin && (
                            <button
                              onClick={() => handleAdminDeleteAvailability(voteSummary?.user_emails?.[n] || n)}
                              style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
                              title="Remove"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
