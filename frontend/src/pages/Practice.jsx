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
  const [voteSummary, setVoteSummary] = useState(null)
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
    // Fetch user availability
    if (user && token) {
      fetch(apiUrl('/api/practice/availability'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(r => r.json())
        .then(data => setAvailability(data || {}))
    } else {
      setAvailability({})
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
    fetch(apiUrl(`/api/practice/availability`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date: selectedDate.toISOString().split('T')[0], status }),
    })
      .then(r => r.json())
      .then(data => {
        setAvailability(prev => ({ ...prev, [selectedDate.toISOString().split('T')[0]]: status }))
        // Refresh vote summary so UI table updates immediately
        return fetch(apiUrl(`/api/practice/availability/${selectedDate.toISOString().split('T')[0]}`))
          .then(r => r.json())
          .then(setVoteSummary)
      })
  }

  const voteBtnStyle = (btnStatus) => {
    const isActive = selectedStatus === btnStatus
    return {
      marginRight: btnStatus !== 'not_available' ? '0.5rem' : undefined,
      padding: '0.5rem 0.75rem',
      borderRadius: '0.375rem',
      border: isActive ? '2px solid #16a34a' : '1px solid #d1d5db',
      background: isActive ? '#dcfce7' : '#ffffff',
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
      const isSelected = Boolean(day) && selectedDate?.toISOString().split('T')[0] === dateStr

      let backgroundColor = '#ffffff'
      if (isAdminSession) backgroundColor = '#86efac' // Green for any day with practice session
      else if (isThursday) backgroundColor = '#f0fdf4' // Light green for Thursdays without session
      if (isSelected) backgroundColor = '#fef08a' // Yellow for selected date

      return (
        <div
          key={`cal-${index}`}
          onClick={() => day && handleDateClick(day)}
          style={{
            border: '1px solid #e5e7eb',
            padding: '0.5rem',
            margin: '2px',
            minHeight: '40px',
            backgroundColor,
            cursor: day ? 'pointer' : 'default',
            borderRadius: '4px',
          }}
        >
          {day}
        </div>
      )
    })
  }

  const selectedSession = adminSessions.find(s => s.date === selectedDate?.toISOString().split('T')[0])
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

      {/* Selected Thursday Details */}
      {selectedDate && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}>
          <h4>{selectedDate.toLocaleDateString()}</h4>
          {selectedSession ? (
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
          {selectedSession && (
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

              <div style={{ marginTop: '1rem' }}>
                <strong>Member Availability</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '0.75rem' }}>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.75rem', background: '#f0fdf4' }}>
                    <div style={{ fontWeight: 'bold' }}>Available</div>
                    <div style={{ marginTop: '0.5rem' }}>
                      {(voteSummary?.available || []).map((n) => (
                        <div key={n}>{n}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.75rem', background: '#fffbeb' }}>
                    <div style={{ fontWeight: 'bold' }}>Tentative</div>
                    <div style={{ marginTop: '0.5rem' }}>
                      {(voteSummary?.tentative || []).map((n) => (
                        <div key={n}>{n}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.75rem', background: '#fef2f2' }}>
                    <div style={{ fontWeight: 'bold' }}>Unavailable</div>
                    <div style={{ marginTop: '0.5rem' }}>
                      {(voteSummary?.not_available || []).map((n) => (
                        <div key={n}>{n}</div>
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
