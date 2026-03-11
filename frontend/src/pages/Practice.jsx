import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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
    fetch('/api/practice/sessions')
      .then(r => r.json())
      .then(data => setAdminSessions(data || []))
    // Fetch user availability
    if (user && token) {
      fetch('/api/practice/availability', {
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
    const clicked = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(clicked)

    const dateStr = formatDateStr(clicked)
    const params = new URLSearchParams(location.search)
    params.set('date', dateStr)
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false })
  }

  const handleAvailability = (status) => {
    if (!user) return
    fetch(`/api/practice/availability`, {
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
        return fetch(`/api/practice/availability/${selectedDate.toISOString().split('T')[0]}`)
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

    return calendar.map(day => {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const isThursday = day && new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay() === 4
      const isAdminSession = adminSessions.some(s => s.date === dateStr)
      const isSelected = Boolean(day) && selectedDate?.toISOString().split('T')[0] === dateStr

      let backgroundColor = '#ffffff'
      if (isThursday && isAdminSession) backgroundColor = '#86efac'
      else if (isThursday) backgroundColor = '#f0fdf4'
      if (isSelected) backgroundColor = '#fef08a'

      return (
        <div
          key={day}
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
    fetch(`/api/practice/availability/${selectedDateStr}`)
      .then(r => r.json())
      .then(setVoteSummary)
      .catch(() => setVoteSummary(null))
  }, [selectedDateStr])

  return (
    <div className="container">
      <h2>Practice</h2>
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
            <p>
              <strong>Practice Session</strong><br />
              Time: {selectedSession.time || 'TBD'}<br />
              Location: {selectedSession.location || 'TBD'}
            </p>
          ) : (
            <p>
              <strong>No practice session</strong><br />
              {user && selectedStatus ? `Your status: ${selectedStatus}` : 'Log in to set your availability'}
            </p>
          )}
          {selectedSession && (
            <>
              <div style={{ marginTop: '1rem' }}>
                <strong>Your Selection</strong>
                <div style={{ marginTop: '0.5rem' }}>
                  <button onClick={() => handleAvailability('available')} style={voteBtnStyle('available')} disabled={!user}>Available</button>
                  <button onClick={() => handleAvailability('tentative')} style={voteBtnStyle('tentative')} disabled={!user}>Tentative</button>
                  <button onClick={() => handleAvailability('not_available')} style={voteBtnStyle('not_available')} disabled={!user}>Not Available</button>
                </div>
                {!user && <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>Log in to vote your availability.</p>}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <strong>Member Availability</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '0.75rem' }}>
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
                    <div style={{ fontWeight: 'bold' }}>Not Available</div>
                    <div style={{ marginTop: '0.5rem' }}>
                      {(voteSummary?.not_available || []).map((n) => (
                        <div key={n}>{n}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.75rem', background: '#f9fafb' }}>
                    <div style={{ fontWeight: 'bold' }}>No Vote</div>
                    <div style={{ marginTop: '0.5rem' }}>
                      {(voteSummary?.no_vote || []).map((n) => (
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
