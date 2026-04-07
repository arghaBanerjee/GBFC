import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiUrl } from '../api'

export default function Practice({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const adminControlsRef = useRef(null)
  const selectedSessionRef = useRef(null)
  const initialLandingParamsRef = useRef((() => {
    const initialParams = new URLSearchParams(location.search)
    return {
      hasDate: Boolean(initialParams.get('date')),
      hasSessionId: Boolean(initialParams.get('date') && initialParams.get('sessionId')),
    }
  })())
  const initialLandingScrollCompletedRef = useRef(!initialLandingParamsRef.current.hasDate)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [availability, setAvailability] = useState({})
  const [adminSessions, setAdminSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionDetailsLoading, setSessionDetailsLoading] = useState(false)
  const [voteSummary, setVoteSummary] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedUserEmail, setSelectedUserEmail] = useState('')
  const [adminSelectedStatus, setAdminSelectedStatus] = useState('available')
  const [sessionCost, setSessionCost] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [maximumCapacity, setMaximumCapacity] = useState('100')
  const [payments, setPayments] = useState({})
  const [paymentUpdatePending, setPaymentUpdatePending] = useState(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [paymentInfoSaved, setPaymentInfoSaved] = useState(false)
  const [adminControlsOpen, setAdminControlsOpen] = useState(false)
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false)
  const [adminAvailabilityUpdating, setAdminAvailabilityUpdating] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [adminAvailabilityError, setAdminAvailabilityError] = useState('')
  const [optionSelectionUpdating, setOptionSelectionUpdating] = useState(false)
  const token = localStorage.getItem('token')

  const eventTypeLabelMap = {
    practice: 'Practice',
    match: 'Match',
    social: 'Social',
    others: 'Other',
  }

  const eventTypeColorMap = {
    practice: '#86EFAC',
    match: '#bfdbfe',
    social: '#fed7aa',
    others: '#ddd6fe',
  }

  const eventTypeAccentMap = {
    practice: 'var(--theme-success-strong)',
    match: 'var(--theme-accent-strong)',
    social: '#c2410c',
    others: '#6d28d9',
  }

  const formatDateStr = (dt) => {
    if (!dt) return null
    const year = dt.getFullYear()
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const parseDateStr = (dateStr) => {
    if (!dateStr) return null
    // Expect YYYY-MM-DD
    const parts = dateStr.split('-').map((p) => Number(p))
    if (parts.length !== 3) return null
    const [y, m, d] = parts
    if (!y || !m || !d) return null
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
    // Validate round-trip
    const rt = formatDateStr(dt)
    if (rt !== dateStr) return null
    return dt
  }

  const getSessionDateTime = (dateStr, timeStr) => {
    if (!dateStr) return null
    const effectiveTime = timeStr || '21:00'
    const [year, month, day] = dateStr.split('-').map(Number)
    const [hours, minutes] = effectiveTime.split(':').map(Number)
    if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) return null
    return new Date(year, month - 1, day, hours, minutes, 0, 0)
  }

  const isSessionPast = (dateStr, timeStr) => {
    const sessionDateTime = getSessionDateTime(dateStr, timeStr)
    if (!sessionDateTime) return false
    return sessionDateTime.getTime() < Date.now()
  }

  const getEventTypeLabel = (eventType) => eventTypeLabelMap[eventType] || 'Event'

  const getEventDisplayTitle = (session) => {
    if (!session) return 'Event'
    const title = session.event_title?.trim()
    return title || getEventTypeLabel(session.event_type)
  }

  const getSessionAvailabilityStatus = (sessionSummary, currentUser) => {
    if (!sessionSummary || !currentUser?.email) return null
    const matchesUser = (name) => sessionSummary.user_emails?.[name] === currentUser.email
    if ((sessionSummary.available || []).some(matchesUser)) return 'available'
    if ((sessionSummary.tentative || []).some(matchesUser)) return 'tentative'
    if ((sessionSummary.not_available || []).some(matchesUser)) return 'not_available'
    return null
  }

  const mergeUpdatedSession = (updatedSession) => {
    if (!updatedSession?.id) return
    setAdminSessions((prev) => {
      const existingIndex = prev.findIndex((session) => session.id === updatedSession.id)
      if (existingIndex === -1) {
        return [...prev, updatedSession].sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date)
          return (a.time || '').localeCompare(b.time || '') || a.id - b.id
        })
      }
      return prev.map((session) =>
        session.id === updatedSession.id ? { ...session, ...updatedSession } : session
      )
    })
  }

  const updateSessionCapacityState = (sessionId, updater) => {
    if (!sessionId) return
    setVoteSummary((prev) => {
      if (!prev) return prev
      const next = updater(prev)
      if (!next) return prev
      return {
        ...next,
        available_count: next.available?.length ?? 0,
        remaining_slots: Math.max((next.maximum_capacity ?? 100) - (next.available?.length ?? 0), 0),
        capacity_reached: (next.available?.length ?? 0) >= (next.maximum_capacity ?? 100),
      }
    })
    setAdminSessions((prev) => prev.map((session) => {
      if (session.id !== sessionId) return session
      const availableCount = voteSummary?.available_count ?? session.available_count ?? 0
      const maximumCapacityValue = voteSummary?.maximum_capacity ?? session.maximum_capacity ?? 100
      const nextSummary = updater({
        available: Array.from({ length: availableCount }),
        maximum_capacity: maximumCapacityValue,
      })
      const nextAvailableCount = nextSummary?.available?.length ?? availableCount
      return {
        ...session,
        available_count: nextAvailableCount,
        remaining_slots: Math.max(maximumCapacityValue - nextAvailableCount, 0),
        capacity_reached: nextAvailableCount >= maximumCapacityValue,
      }
    }))
  }

  const refreshSelectedDateData = (session, { refreshAvailabilityMap = false, refreshPayments = false } = {}) => {
    if (!session?.id) return Promise.resolve()
    const requests = [
      fetch(apiUrl(`/api/practice/sessions/id/${session.id}/availability`))
        .then(r => r.json())
        .then((data) => {
          setVoteSummary(data)
          mergeUpdatedSession({
            id: session.id,
            maximum_capacity: data.maximum_capacity,
            available_count: data.available_count,
            remaining_slots: data.remaining_slots,
            capacity_reached: data.capacity_reached,
          })
        })
        .catch(() => {}),
    ]

    if (refreshAvailabilityMap && token) {
      requests.push(
        fetch(apiUrl('/api/practice/availability'), {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.json())
          .then(data => setAvailability(data || {}))
          .catch(() => {})
      )
    }

    if (refreshPayments && token) {
      requests.push(
        fetch(apiUrl(`/api/practice/sessions/id/${session.id}/payments`), {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.json())
          .then(data => setPayments(data || {}))
          .catch(() => setPayments({}))
      )
    }

    return Promise.all(requests)
  }

  // Sync from URL -> selected date
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const dateStr = params.get('date')
    const sessionIdParam = params.get('sessionId')
    const dt = parseDateStr(dateStr)
    if (!dt) {
      setSelectedDate(null)
      setSelectedSessionId(null)
      setCurrentDate(new Date())
      return
    }

    const parsedSessionId = sessionIdParam != null ? Number(sessionIdParam) : null
    setSelectedSessionId(Number.isInteger(parsedSessionId) ? parsedSessionId : null)

    const currentSelected = selectedDate ? formatDateStr(selectedDate) : null
    if (currentSelected !== dateStr) {
      setSelectedDate(dt)
      setCurrentDate(new Date(dt.getFullYear(), dt.getMonth(), 1))
    }
  }, [location.search])

  useEffect(() => {
    // Fetch admin-created events
    setSessionsLoading(true)
    fetch(apiUrl('/api/practice/sessions'))
      .then(r => r.json())
      .then(data => setAdminSessions(data || []))
      .catch(() => setAdminSessions([]))
      .finally(() => setSessionsLoading(false))
    
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
      setAllUsers([])
    }
  }, [user, token])

  useEffect(() => {
    setIsAdmin(user?.user_type === 'admin')
    if (user?.user_type !== 'admin') {
      setAdminControlsOpen(false)
      setAllUsers([])
    }
  }, [user])

  useEffect(() => {
    if (!isAdmin || !adminControlsOpen || !token || allUsers.length > 0 || adminUsersLoading) return

    setAdminUsersLoading(true)
    fetch(apiUrl('/api/users'), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(r => r.json())
      .then(data => setAllUsers(data || []))
      .catch(() => setAllUsers([]))
      .finally(() => setAdminUsersLoading(false))
  }, [isAdmin, adminControlsOpen, token, allUsers.length, adminUsersLoading])

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = monthStart.getDay()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDate(null)
    setSelectedSessionId(null)
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDate(null)
    setSelectedSessionId(null)
  }

  const handleDateClick = (day) => {
    const clicked = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 12, 0, 0, 0)
    setSelectedDate(clicked)
    setSelectedSessionId(null)

    const dateStr = formatDateStr(clicked)
    const params = new URLSearchParams(location.search)
    params.set('date', dateStr)
    params.delete('sessionId')
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false })
  }

  const handleToggleAdminControls = () => {
    adminControlsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setAdminControlsOpen((prev) => !prev)
  }

  const handleAvailability = (status) => {
    if (!user || availabilityUpdating) return
    if (!selectedSession) return
    
    const dateStr = selectedSession.date
    const sessionAvailabilityKey = String(selectedSession.id)
    if (isSessionPast(dateStr, selectedSession?.time)) {
      setAvailabilityError('Cannot change availability after session time has passed.')
      return
    }
    const currentStatus = selectedStatus
    const previousAvailability = availability
    const previousVoteSummary = voteSummary
    
    // Toggle: if clicking the same button, deselect (remove availability)
    const isDeselecting = currentStatus === status
    const newStatus = isDeselecting ? 'none' : status
    setAvailabilityError('')
    setAvailabilityUpdating(true)

    if (isDeselecting) {
      setAvailability(prev => {
        const updated = { ...prev }
        delete updated[sessionAvailabilityKey]
        return updated
      })
    } else {
      setAvailability(prev => ({ ...prev, [sessionAvailabilityKey]: newStatus }))
    }

    if (currentStatus === 'available' || newStatus === 'available') {
      updateSessionCapacityState(selectedSession.id, (prev) => {
        const available = [...(prev.available || [])]
        const currentName = user.full_name || user.email
        const filteredAvailable = available.filter((name) => {
          const email = prev.user_emails?.[name] || name
          return email !== user.email
        })
        if (newStatus === 'available') {
          filteredAvailable.push(currentName)
        }
        return {
          ...prev,
          available: filteredAvailable,
          user_emails: {
            ...(prev.user_emails || {}),
            [currentName]: user.email,
          },
        }
      })
    }
    
    fetch(apiUrl(`/api/practice/sessions/id/${selectedSession.id}/availability`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
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
        return refreshSelectedDateData(selectedSession)
      })
      .catch(err => {
        setAvailability(previousAvailability)
        setVoteSummary(previousVoteSummary)
        setAvailabilityError(err.message || 'Failed to update availability')
        console.error('Failed to update availability:', err)
      })
      .finally(() => setAvailabilityUpdating(false))
  }

  const handleOptionSelection = (optionChoice) => {
    if (!user || !selectedSession || selectedStatus !== 'available' || optionSelectionUpdating) return

    const currentChoice = selectedOptionChoice
    const nextChoice = currentChoice === optionChoice ? null : optionChoice
    const previousVoteSummary = voteSummary
    const currentName = user.full_name || user.email

    setAvailabilityError('')
    setOptionSelectionUpdating(true)
    setVoteSummary((prev) => {
      if (!prev) return prev
      const nextOptionA = (prev.option_a || []).filter((name) => name !== currentName)
      const nextOptionB = (prev.option_b || []).filter((name) => name !== currentName)
      if (nextChoice === 'A') nextOptionA.push(currentName)
      if (nextChoice === 'B') nextOptionB.push(currentName)
      return {
        ...prev,
        option_a: nextOptionA,
        option_b: nextOptionB,
      }
    })

    fetch(apiUrl(`/api/practice/sessions/id/${selectedSession.id}/availability`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: 'available',
        option_choice: nextChoice,
      }),
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to update option selection')
          })
        }
        return r.json()
      })
      .then(() => refreshSelectedDateData(selectedSession))
      .catch(err => {
        setVoteSummary(previousVoteSummary)
        setAvailabilityError(err.message || 'Failed to update option selection')
        console.error('Failed to update option selection:', err)
      })
      .finally(() => setOptionSelectionUpdating(false))
  }

  const handleSavePaymentInfo = () => {
    if (!selectedSession) return
    
    fetch(apiUrl(`/api/practice/sessions/id/${selectedSession.id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: selectedSession.date,
        time: selectedSession.time,
        location: selectedSession.location,
        event_type: selectedSession.event_type,
        event_title: selectedSession.event_title,
        description: selectedSession.description,
        image_url: selectedSession.image_url,
        youtube_url: selectedSession.youtube_url,
        option_a_text: selectedSession.option_a_text,
        option_b_text: selectedSession.option_b_text,
        session_cost: sessionCost ? parseFloat(sessionCost) : null,
        paid_by: paidBy || null,
        maximum_capacity: maximumCapacity ? parseInt(maximumCapacity, 10) : 100,
      }),
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to save payment info')
          })
        }
        return r.json()
      })
      .then((updatedSession) => {
        mergeUpdatedSession(updatedSession)
        setSessionCost(updatedSession.session_cost != null ? updatedSession.session_cost.toString() : '')
        setPaidBy(updatedSession.paid_by || '')
        setMaximumCapacity((updatedSession.maximum_capacity || 100).toString())
        setPaymentInfoSaved(Boolean(updatedSession.session_cost != null && updatedSession.paid_by))
        return fetch(apiUrl('/api/practice/sessions'))
          .then(r => r.json())
          .then(data => setAdminSessions(data || []))
      })
      .catch(err => console.error('Failed to save payment info:', err))
  }

  const handleRequestPayment = () => {
    if (!selectedSession) return
    
    if (!window.confirm(
      '⚠️ WARNING: This action cannot be reversed!\n\n' +
      'Before enabling payment request, please review:\n' +
      `• Total Cost: £${sessionCost || '0'}\n` +
      `• Paid by: ${paidBy || 'Not set'}\n` +
      `• Available users: ${voteSummary?.available?.length || 0}\n\n` +
      'Once enabled, users will be asked to confirm payment.\n\n' +
      'Do you want to continue?'
    )) {
      return
    }
    
    fetch(apiUrl(`/api/practice/sessions/id/${selectedSession.id}/request-payment`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to request payment')
          })
        }
        return r.json()
      })
      .then(() => {
        // Refresh admin sessions
        return fetch(apiUrl('/api/practice/sessions'))
          .then(r => r.json())
          .then(data => setAdminSessions(data || []))
      })
      .catch(err => console.error('Failed to request payment:', err))
  }

  const handlePaymentConfirmation = (paid) => {
    if (!selectedSession) return
    if (!user?.email) return
    const previousPaid = Boolean(payments[user.email])
    setPaymentUpdatePending(true)
    setPayments((prev) => ({
      ...prev,
      [user.email]: paid,
    }))
    
    fetch(apiUrl(`/api/practice/sessions/id/${selectedSession.id}/payment`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ paid }),
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to update payment status')
          })
        }
        return r.json()
      })
      .then(() => {
        // Refresh payment data
        return fetch(apiUrl(`/api/practice/sessions/id/${selectedSession.id}/payments`), {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(data => setPayments(data || {}))
      })
      .catch(err => {
        setPayments((prev) => ({
          ...prev,
          [user.email]: previousPaid,
        }))
        console.error('Failed to update payment:', err)
      })
      .finally(() => setPaymentUpdatePending(false))
  }

  const handleAdminSetAvailability = () => {
    if (!selectedUserEmail || adminAvailabilityUpdating || !selectedSession) {
      return
    }
    setAdminAvailabilityError('')
    setAdminAvailabilityUpdating(true)
    
    fetch(apiUrl(`/api/admin/practice/sessions/id/${selectedSession.id}/availability`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
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
        return refreshSelectedDateData(selectedSession, { refreshAvailabilityMap: selectedUserEmail === user?.email })
      })
      .then(() => {
        setSelectedUserEmail('')
      })
      .catch(err => {
        setAdminAvailabilityError(err.message || 'Failed to set availability')
        console.error('Failed to set availability:', err)
      })
      .finally(() => setAdminAvailabilityUpdating(false))
  }

  const handleAdminDeleteAvailability = (userEmail) => {
    if (!selectedSession) return
    if (!confirm('Are you sure you want to remove this user\'s availability?')) {
      return
    }
    setAdminAvailabilityError('')
    setAdminAvailabilityUpdating(true)
    
    fetch(apiUrl(`/api/admin/practice/sessions/id/${selectedSession.id}/availability`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
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
        return refreshSelectedDateData(selectedSession, { refreshAvailabilityMap: userEmail === user?.email })
      })
      .catch(err => {
        setAdminAvailabilityError(err.message || 'Failed to delete availability')
      })
      .finally(() => setAdminAvailabilityUpdating(false))
  }

  const voteBtnStyle = (btnStatus) => {
    const isActive = selectedStatus === btnStatus

    let activeColor, activeBg, activeBorder
    if (btnStatus === 'available') {
      activeColor = 'var(--theme-success-strong)'
      activeBg = 'var(--theme-success-soft)'
      activeBorder = 'var(--theme-success)'
    } else if (btnStatus === 'tentative') {
      activeColor = 'var(--theme-warning-strong)'
      activeBg = 'var(--theme-warning-soft)'
      activeBorder = 'var(--theme-warning)'
    } else {
      activeColor = 'var(--theme-danger-strong)'
      activeBg = 'var(--theme-danger-soft)'
      activeBorder = 'var(--theme-danger)'
    }

    return {
      padding: '0.85rem 0.75rem',
      borderRadius: '0.375rem',
      border: isActive ? `2px solid ${activeBorder}` : '1px solid var(--theme-border)',
      background: isActive ? activeBg : 'var(--theme-surface)',
      color: isActive ? activeColor : 'var(--theme-text)',
      fontWeight: isActive ? 700 : 400,
      fontSize: '0.95rem',
      minWidth: 0,
      minHeight: '48px',
      width: '100%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      boxSizing: 'border-box',
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
      const sessionsForDate = adminSessions.filter(s => s.date === dateStr)
      const isSelected = Boolean(day) && formatDateStr(selectedDate) === dateStr
      const uniqueEventTypes = [...new Set(sessionsForDate.map((session) => session.event_type || 'practice'))]

      let background = '#ffffff'
      if (uniqueEventTypes.length === 1) {
        background = eventTypeColorMap[uniqueEventTypes[0]] || eventTypeColorMap.practice
      } else if (uniqueEventTypes.length > 1) {
        const segmentSize = 100 / uniqueEventTypes.length
        background = `linear-gradient(135deg, ${uniqueEventTypes.map((eventType, idx) => {
          const color = eventTypeColorMap[eventType] || eventTypeColorMap.practice
          const start = Math.round(idx * segmentSize)
          const end = Math.round((idx + 1) * segmentSize)
          return `${color} ${start}%, ${color} ${end}%`
        }).join(', ')})`
      }

      return (
        <div
          key={`cal-${index}`}
          onClick={() => day && handleDateClick(day)}
          style={{
            border: isSelected ? '2px solid var(--theme-accent-strong)' : '1px solid #e5e7eb',
            padding: '0.5rem',
            margin: '2px',
            minHeight: '40px',
            background,
            cursor: day ? 'pointer' : 'default',
            borderRadius: '6px',
            boxShadow: isSelected ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.65), 0 0 0 3px color-mix(in srgb, var(--theme-accent) 24%, transparent), 0 8px 20px rgba(0, 0, 0, 0.14)' : 'none',
            transform: isSelected ? 'scale(1.03)' : 'scale(1)',
            transition: 'all 0.2s ease',
            fontWeight: isSelected ? '700' : '400',
          }}
        >
          <div>{day}</div>
          {sessionsForDate.length > 1 && (
            <div style={{ marginTop: '0.25rem', fontSize: '0.625rem', fontWeight: '700', color: 'var(--theme-heading)' }}>
              {sessionsForDate.length} events
            </div>
          )}
        </div>
      )
    })
  }

  const selectedDateStr = selectedDate ? formatDateStr(selectedDate) : null
  const urlParams = new URLSearchParams(location.search)
  const requestedSessionIdParam = urlParams.get('sessionId')
  const requestedSessionId = requestedSessionIdParam != null ? Number(requestedSessionIdParam) : null
  const hasRequestedSessionId = Number.isInteger(requestedSessionId)
  const sessionsForSelectedDate = selectedDateStr
    ? adminSessions.filter((session) => session.date === selectedDateStr)
    : []
  const hasMultipleSessionsForSelectedDate = sessionsForSelectedDate.length > 1
  const selectedSession = selectedSessionId == null
    ? (hasMultipleSessionsForSelectedDate ? null : sessionsForSelectedDate[0] || null)
    : sessionsForSelectedDate.find((session) => session.id === selectedSessionId) || null
  const shouldShowInitialLandingLoader = Boolean(
    !initialLandingScrollCompletedRef.current &&
    initialLandingParamsRef.current.hasDate &&
    (
      sessionsLoading ||
      (hasRequestedSessionId
        ? (!selectedSession || sessionDetailsLoading)
        : sessionsForSelectedDate.length === 1 && (!selectedSession || sessionDetailsLoading))
    )
  )
  const selectedStatus = getSessionAvailabilityStatus(voteSummary, user)
  const selectedPaidByUser = allUsers.find((u) => u.email === paidBy)
  const selectedEventTypeLabel = getEventTypeLabel(selectedSession?.event_type)
  const selectedEventTitle = getEventDisplayTitle(selectedSession)
  const paidByBankDetails = selectedSession?.payment_requested
    ? {
        full_name: selectedSession?.paid_by_name || selectedSession?.paid_by,
        bank_name: selectedSession?.paid_by_bank_name,
        sort_code: selectedSession?.paid_by_sort_code,
        account_number: selectedSession?.paid_by_account_number,
      }
    : {
        full_name: selectedPaidByUser?.full_name || selectedPaidByUser?.email,
        bank_name: selectedPaidByUser?.bank_name,
        sort_code: selectedPaidByUser?.sort_code,
        account_number: selectedPaidByUser?.account_number,
      }
  const hasPaidByBankDetails = Boolean(
    paidByBankDetails.bank_name && paidByBankDetails.sort_code && paidByBankDetails.account_number
  )

  // Check if current user is in the available list (for payment card visibility)
  // voteSummary.available is an array of names (strings), use user_emails mapping to check
  const isUserAvailable = user && voteSummary?.user_emails && voteSummary?.available 
    ? voteSummary.available.some(name => {
        const email = voteSummary.user_emails[name]
        return email === user.email
      })
    : false

  useEffect(() => {
    if (!selectedDate) return
    const isInitialLanding = !initialLandingScrollCompletedRef.current && initialLandingParamsRef.current.hasDate
    let targetId = selectedSessionId ? 'selected-session-details' : 'selected-date-details'

    if (isInitialLanding) {
      if (sessionsLoading) return

      if (hasRequestedSessionId) {
        if (!selectedSession || sessionDetailsLoading) return
        targetId = 'selected-session-details'
      } else if (sessionsForSelectedDate.length === 1) {
        if (!selectedSession || sessionDetailsLoading) return
        targetId = 'selected-session-details'
      } else {
        targetId = 'selected-date-details'
      }
    }

    const target = document.getElementById(targetId)
    if (!target) return
    window.requestAnimationFrame(() => {
      const header = document.querySelector('.top-nav')
      const headerHeight = header ? header.getBoundingClientRect().height : 0
      const extraOffset = window.innerWidth <= 768 ? 12 : 16
      const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight - extraOffset
      window.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: 'smooth',
      })
      if (isInitialLanding) {
        initialLandingScrollCompletedRef.current = true
      }
    })
  }, [selectedDate, selectedSessionId, selectedSession?.id, sessionsLoading, sessionDetailsLoading, sessionsForSelectedDate.length, hasRequestedSessionId])

  useEffect(() => {
    if (!selectedDateStr || !selectedSession) {
      setSessionDetailsLoading(false)
      setVoteSummary(null)
      setPayments({})
      return
    }
    let cancelled = false
    setSessionDetailsLoading(true)

    const availabilityRequest = fetch(apiUrl(`/api/practice/sessions/id/${selectedSession.id}/availability`))
      .then(r => r.json())
      .then((data) => {
        if (cancelled) return
        setVoteSummary(data)
      })
      .catch(() => {
        if (cancelled) return
        setVoteSummary(null)
      })
    
    let paymentsRequest = Promise.resolve()
    if (token) {
      paymentsRequest = fetch(apiUrl(`/api/practice/sessions/id/${selectedSession.id}/payments`), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (cancelled) return
          setPayments(data || {})
        })
        .catch(() => {
          if (cancelled) return
          setPayments({})
        })
    } else {
      setPayments({})
    }

    Promise.all([availabilityRequest, paymentsRequest]).finally(() => {
      if (cancelled) return
      setSessionDetailsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [selectedDateStr, selectedSession?.id, token])

  useEffect(() => {
    if (!selectedDateStr) {
      setSelectedSessionId(null)
      return
    }
    if (!sessionsForSelectedDate.length) {
      return
    }
    if (hasRequestedSessionId) {
      if (sessionsForSelectedDate.some((session) => session.id === requestedSessionId)) {
        if (selectedSessionId !== requestedSessionId) {
          setSelectedSessionId(requestedSessionId)
        }
        return
      }
    }
    if (sessionsForSelectedDate.length === 1) {
      if (selectedSessionId !== sessionsForSelectedDate[0].id) {
        setSelectedSessionId(sessionsForSelectedDate[0].id)
      }
      return
    }
    if (selectedSessionId != null && !sessionsForSelectedDate.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(null)
    }
  }, [selectedDateStr, selectedSessionId, sessionsForSelectedDate, hasRequestedSessionId, requestedSessionId])
  
  // Update session cost and paid_by when selected session data changes
  useEffect(() => {
    if (selectedSession) {
      setSessionCost(selectedSession.session_cost != null ? selectedSession.session_cost.toString() : '')
      setPaidBy(selectedSession.paid_by || '')
      setMaximumCapacity((selectedSession.maximum_capacity || 100).toString())
      // Check if payment info is already saved (both fields have values in DB)
      setPaymentInfoSaved(Boolean(selectedSession.session_cost != null && selectedSession.paid_by))
    } else {
      setSessionCost('')
      setPaidBy('')
      setMaximumCapacity('100')
      setPaymentInfoSaved(false)
    }
  }, [selectedSession])

  const sessionMaximumCapacity = selectedSession?.maximum_capacity || voteSummary?.maximum_capacity || 100
  const sessionAvailableCount = voteSummary?.available_count ?? voteSummary?.available?.length ?? selectedSession?.available_count ?? 0
  const sessionRemainingSlots = voteSummary?.remaining_slots ?? Math.max(sessionMaximumCapacity - sessionAvailableCount, 0)
  const isCapacityReached = Boolean(voteSummary?.capacity_reached ?? selectedSession?.capacity_reached ?? (sessionAvailableCount >= sessionMaximumCapacity))
  const sessionCapacityRatio = sessionMaximumCapacity > 0 ? Math.min(sessionAvailableCount / sessionMaximumCapacity, 1) : 0
  const sessionBookingPercentage = Math.round(sessionCapacityRatio * 100)
  const capacityChartRadius = 26
  const capacityChartCircumference = 2 * Math.PI * capacityChartRadius
  const capacityChartOffset = capacityChartCircumference * (1 - sessionCapacityRatio)
  const hasSelectedSessionPassed = Boolean(selectedSession && isSessionPast(selectedSession.date, selectedSession.time))
  const canSelectAvailable = selectedStatus === 'available' || !isCapacityReached
  const optionSectionEnabled = Boolean(selectedSession?.option_a_text && selectedSession?.option_b_text)
  const getDisplayFirstName = (name) => {
    const trimmedName = (name || '').trim()
    if (!trimmedName) return ''
    return trimmedName.split(/\s+/)[0]
  }
  const formatDisplayNames = (names = []) => names.map(getDisplayFirstName).filter(Boolean).join(', ')
  const selectedOptionChoice = user && voteSummary?.user_emails
    ? (voteSummary.option_a || []).some((name) => voteSummary.user_emails[name] === user.email)
      ? 'A'
      : (voteSummary.option_b || []).some((name) => voteSummary.user_emails[name] === user.email)
        ? 'B'
        : null
    : null
  const canSavePaymentInfo = Boolean(sessionCost && paidBy && maximumCapacity && Number(maximumCapacity) > 0)
  const availablePlayersForPayment = voteSummary?.available?.length || 0
  const paidAvailablePlayersCount = (voteSummary?.available || []).reduce((count, name) => {
    const userEmail = voteSummary?.user_emails?.[name] || name
    return count + (payments[userEmail] ? 1 : 0)
  }, 0)
  const adminAvailableBlockedByCapacity = adminSelectedStatus === 'available' && isCapacityReached

  return (
    <div className="container">
      <h2>Club Calendar</h2>
      <p style={{ marginBottom: '1rem', color: 'var(--theme-text-muted)' }}>Select a date to view events and set availability.</p>
      
      {/* Color Legend */}
      <div style={{ 
        marginBottom: '1rem', 
        padding: '0.75rem', 
        background: 'var(--theme-surface-alt)', 
        borderRadius: '0.5rem',
        border: '1px solid var(--theme-border)'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
          {Object.entries(eventTypeLabelMap).map(([eventType, label]) => (
            <div key={eventType} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '20px', height: '20px', background: eventTypeColorMap[eventType], borderRadius: '4px', border: '1px solid var(--theme-border)' }}></div>
              <span style={{ color: 'var(--theme-text)' }}>{label}</span>
            </div>
          ))}
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
        <div id="selected-date-details" ref={selectedSessionRef} style={{ background: 'var(--theme-surface)', borderRadius: 12, padding: '1.5rem', minHeight: 220, boxShadow: 'var(--theme-card-shadow)', border: '1px solid var(--theme-border)' }}>
          {hasMultipleSessionsForSelectedDate && (
            <div style={{ marginBottom: '1rem', padding: '0.875rem', background: 'var(--theme-surface-alt)', borderRadius: '0.75rem', border: '1px solid var(--theme-border)' }}>
              <div style={{ fontWeight: '600', color: 'var(--theme-heading)', marginBottom: '0.625rem' }}>Events on {selectedDate.toDateString()}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--theme-text-muted)', marginBottom: '0.75rem' }}>
                Select an event to view details and set availability.
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {sessionsForSelectedDate.map((session) => {
                  const isActive = selectedSession?.id === session.id
                  const eventLabel = getEventTypeLabel(session.event_type)
                  const eventTitle = getEventDisplayTitle(session)
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => {
                        setSelectedSessionId(session.id)
                        const params = new URLSearchParams(location.search)
                        params.set('date', session.date)
                        params.set('sessionId', String(session.id))
                        navigate({ pathname: location.pathname, search: params.toString() }, { replace: false })
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.75rem 0.875rem',
                        borderRadius: '0.625rem',
                        border: isActive ? '2px solid var(--theme-accent)' : '1px solid var(--theme-border)',
                        background: isActive ? 'color-mix(in srgb, var(--theme-accent) 10%, white)' : 'var(--theme-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <strong style={{ color: eventTypeAccentMap[session.event_type] || 'var(--theme-heading)' }}>{eventLabel}</strong>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--theme-text-muted)' }}>{session.time || 'TBD'}</span>
                      </div>
                      <div style={{ color: 'var(--theme-heading)', fontWeight: '500', marginBottom: '0.2rem' }}>{eventTitle}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--theme-text-muted)' }}>{session.location || 'Location TBD'}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {selectedSession ? (
            <div id="selected-session-details" style={{ marginBottom: '1rem', padding: '0.875rem', background: 'var(--theme-surface-alt)', borderRadius: '0.75rem', border: '1px solid var(--theme-border)' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--theme-heading)' }}>{selectedDate ? selectedDate.toDateString() : 'Select a date'}</h3>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: eventTypeAccentMap[selectedSession.event_type] || 'var(--theme-heading)', fontSize: '1.25rem' }}>{selectedEventTypeLabel}</strong>
                <div style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '500', color: 'var(--theme-heading)' }}>{selectedEventTitle}</div>
              </div>
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
              <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem', borderRadius: '0.875rem', background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}>
                <div style={{ position: 'relative', width: '72px', height: '72px', flex: '0 0 72px' }}>
                  <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                    <circle cx="36" cy="36" r="26" fill="none" stroke="color-mix(in srgb, var(--theme-border) 78%, white)" strokeWidth="8" />
                    <circle cx="36" cy="36" r="26" fill="none" stroke={isCapacityReached ? 'var(--theme-warning-strong)' : 'var(--theme-success-strong)'} strokeWidth="8" strokeLinecap="round" strokeDasharray={capacityChartCircumference} strokeDashoffset={capacityChartOffset} transform="rotate(-90 36 36)" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--theme-heading)' }}>{sessionBookingPercentage}%</strong>
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--theme-text-muted)', marginBottom: '0.25rem' }}>Capacity</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: isCapacityReached ? 'var(--theme-warning-strong)' : 'var(--theme-success-strong)', marginBottom: '0.2rem' }}>
                    {sessionAvailableCount}/{sessionMaximumCapacity} booked
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--theme-text-muted)' }}>
                    {sessionRemainingSlots > 0 ? `+${sessionRemainingSlots} slot${sessionRemainingSlots === 1 ? '' : 's'} available` : 'No slots available'}
                  </div>
                </div>
              </div>
            </div>
          ) : shouldShowInitialLandingLoader ? (
            <div id="selected-session-details" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--theme-surface-alt)', borderRadius: '0.75rem', border: '1px solid var(--theme-border)' }}>
              <h3 style={{ marginBottom: '0.875rem', color: 'var(--theme-heading)' }}>{selectedDate ? selectedDate.toDateString() : 'Loading event'}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', borderRadius: '0.875rem', background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '999px', border: '3px solid color-mix(in srgb, var(--theme-accent) 20%, white)', borderTopColor: 'var(--theme-accent)', animation: 'spin 0.8s linear infinite', flex: '0 0 auto' }} />
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--theme-heading)', marginBottom: '0.2rem' }}>{hasRequestedSessionId || sessionsForSelectedDate.length === 1 ? 'Loading event details' : 'Loading events'}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--theme-text-muted)' }}>{hasRequestedSessionId ? 'Preparing the selected session from your link...' : 'Preparing events for the selected date...'}</div>
                </div>
              </div>
            </div>
          ) : hasMultipleSessionsForSelectedDate ? (
            <div></div>
          ) : (
            <div>
              <h3 style={{ marginBottom: '1rem', color: 'var(--theme-heading)' }}>{selectedDate ? selectedDate.toDateString() : 'Select a date'}</h3>
            <div style={{ padding: '1rem', borderRadius: '0.75rem', background: 'var(--theme-surface-alt)', border: '1px dashed var(--theme-border)', color: 'var(--theme-text-muted)' }}>
              No event is scheduled on this date. Please select a date highlighted in colour to view the event details and save your selection.
            </div>
            </div>
          )}
          {selectedSession && (
            <>
              {isAdmin && (
                <div ref={adminControlsRef} style={{ marginTop: '1rem', background: 'color-mix(in srgb, var(--theme-danger) 8%, var(--theme-surface))', borderRadius: '0.75rem', border: '1px solid color-mix(in srgb, var(--theme-danger) 24%, white)', overflow: 'hidden', boxShadow: adminControlsOpen ? 'var(--theme-card-shadow)' : 'none', transition: 'all 0.25s ease' }}>
                  <button
                    type="button"
                    onClick={handleToggleAdminControls}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: adminControlsOpen ? 'color-mix(in srgb, var(--theme-danger) 12%, white)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.25s ease',
                    }}
                  >
                    <strong style={{ color: 'var(--theme-danger-strong)' }}>Admin Controls</strong>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--theme-danger-strong)', fontSize: '0.875rem', fontWeight: '600' }}>
                      {adminControlsOpen ? 'Hide' : 'Show'}
                      <span style={{ display: 'inline-block', transform: adminControlsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}>⌄</span>
                    </span>
                  </button>

                  <div style={{ maxHeight: adminControlsOpen ? '1200px' : '0', opacity: adminControlsOpen ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease, opacity 0.25s ease' }}>
                    <div style={{ padding: adminControlsOpen ? '0 1rem 1rem 1rem' : '0 1rem', transform: adminControlsOpen ? 'translateY(0)' : 'translateY(-8px)', transition: 'padding 0.25s ease, transform 0.25s ease' }}>
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--theme-surface)', borderRadius: '0.5rem', border: '1px solid var(--theme-border)' }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--theme-heading)' }}>Payment Information</div>
                        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
                          <div style={{ flex: '0 0 100px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--theme-text-muted)', marginBottom: '0.25rem' }}>Event Cost (£)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={sessionCost}
                              onChange={(e) => {
                                setSessionCost(e.target.value)
                                setPaymentInfoSaved(false)
                              }}
                              placeholder="0.00"
                              disabled={selectedSession?.payment_requested}
                              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', fontSize: '0.875rem', opacity: selectedSession?.payment_requested ? 0.6 : 1, cursor: selectedSession?.payment_requested ? 'not-allowed' : 'text' }}
                            />
                          </div>
                          <div style={{ flex: '1' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--theme-text-muted)', marginBottom: '0.25rem' }}>Paid By</label>
                            {selectedSession?.payment_requested ? (
                              <input
                                type="text"
                                value={selectedSession.paid_by_name || selectedSession.paid_by || 'Not set'}
                                disabled
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', fontSize: '0.75rem', opacity: 0.6, cursor: 'not-allowed', backgroundColor: 'var(--theme-surface-alt)', color: 'var(--theme-text)' }}
                              />
                            ) : (
                              <select
                                value={paidBy}
                                onChange={(e) => {
                                  setPaidBy(e.target.value)
                                  setPaymentInfoSaved(false)
                                }}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', fontSize: '0.875rem', cursor: 'pointer' }}
                              >
                                <option value="">Select user...</option>
                                {allUsers.map((u) => (
                                  <option key={u.email} value={u.email}>{u.full_name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                        {!selectedSession?.payment_requested && paidBy && !hasPaidByBankDetails && !adminUsersLoading && (
                          <div style={{ marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--theme-warning-strong)', background: 'var(--theme-warning-soft)', border: '1px solid color-mix(in srgb, var(--theme-warning) 28%, white)', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }}>
                            Bank Details not available for the user
                          </div>
                        )}
                        {adminUsersLoading && <div style={{ marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--theme-text-muted)' }}>Loading users...</div>}
                        {hasPaidByBankDetails && (
                          <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--theme-surface-alt)', borderRadius: '0.375rem', border: '1px solid var(--theme-border)' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--theme-heading)' }}>Bank Details</div>
                            <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--theme-text)' }}>
                              <div><strong>Account Holder:</strong> {paidByBankDetails.full_name || 'Unknown User'}</div>
                              <div><strong>Bank Name:</strong> {paidByBankDetails.bank_name}</div>
                              <div><strong>Sort Code:</strong> {paidByBankDetails.sort_code}</div>
                              <div><strong>Account Number:</strong> {paidByBankDetails.account_number}</div>
                            </div>
                          </div>
                        )}
                        {!selectedSession?.payment_requested && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button onClick={handleSavePaymentInfo} disabled={!canSavePaymentInfo} style={{ flex: '1', padding: '0.5rem 1rem', borderRadius: '0.375rem', background: !canSavePaymentInfo ? 'var(--theme-border)' : paymentInfoSaved ? 'var(--theme-success)' : 'var(--theme-accent)', color: !canSavePaymentInfo ? 'var(--theme-text-muted)' : 'var(--theme-accent-contrast)', border: 'none', cursor: !canSavePaymentInfo ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem', transition: 'all 0.2s' }}>
                              {paymentInfoSaved ? '✓ Saved - Click to Update' : 'Save Payment Info'}
                            </button>
                            <button onClick={handleRequestPayment} disabled={!paymentInfoSaved || !hasSelectedSessionPassed} style={{ flex: '1', padding: '0.5rem 1rem', borderRadius: '0.375rem', background: (!paymentInfoSaved || !hasSelectedSessionPassed) ? 'var(--theme-border)' : 'var(--theme-danger)', color: (!paymentInfoSaved || !hasSelectedSessionPassed) ? 'var(--theme-text-muted)' : 'var(--theme-danger-contrast)', border: 'none', cursor: (!paymentInfoSaved || !hasSelectedSessionPassed) ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem', transition: 'all 0.2s' }}>
                              {!hasSelectedSessionPassed ? 'Available after session' : !paymentInfoSaved ? 'Save payment info first' : '⚠️ Request Payment'}
                            </button>
                          </div>
                        )}
                        {selectedSession?.payment_requested && (
                          <div style={{ padding: '0.5rem', background: 'var(--theme-success-soft)', borderRadius: '0.375rem', fontSize: '0.875rem', color: 'var(--theme-success-strong)', fontWeight: '600', textAlign: 'center' }}>
                            ✓ Payment Requested
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--theme-surface)', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', opacity: selectedSession?.payment_requested ? 0.6 : 1, pointerEvents: selectedSession?.payment_requested ? 'none' : 'auto' }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--theme-heading)' }}>Set Player Availability</div>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
                          <div style={{ flex: '0 0 140px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--theme-text-muted)', marginBottom: '0.25rem' }}>Availability</label>
                            <select value={adminSelectedStatus} onChange={(e) => setAdminSelectedStatus(e.target.value)} disabled={selectedSession?.payment_requested || adminAvailabilityUpdating} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', fontSize: '0.875rem' }}>
                              <option value="available">Available</option>
                              <option value="tentative">Tentative</option>
                              <option value="not_available">Unavailable</option>
                            </select>
                          </div>
                          <div style={{ flex: '1' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--theme-text-muted)', marginBottom: '0.25rem' }}>Select Player</label>
                            <select value={selectedUserEmail} onChange={(e) => setSelectedUserEmail(e.target.value)} disabled={selectedSession?.payment_requested || adminAvailabilityUpdating} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', fontSize: '0.875rem' }}>
                              <option value="">Select a user...</option>
                              {allUsers.map((u) => (
                                <option key={u.email} value={u.email}>{u.full_name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <button onClick={handleAdminSetAvailability} disabled={!selectedUserEmail || selectedSession?.payment_requested || adminAvailabilityUpdating || adminAvailableBlockedByCapacity} style={{ width: '100%', padding: '0.5rem 1rem', borderRadius: '0.375rem', background: (!selectedUserEmail || selectedSession?.payment_requested || adminAvailabilityUpdating || adminAvailableBlockedByCapacity) ? 'var(--theme-border)' : 'var(--theme-accent)', color: (!selectedUserEmail || selectedSession?.payment_requested || adminAvailabilityUpdating || adminAvailableBlockedByCapacity) ? 'var(--theme-text-muted)' : 'var(--theme-accent-contrast)', border: 'none', cursor: (!selectedUserEmail || selectedSession?.payment_requested || adminAvailabilityUpdating || adminAvailableBlockedByCapacity) ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem', transition: 'all 0.2s' }}>
                          {adminAvailabilityUpdating ? 'Updating...' : 'Set Availability'}
                        </button>
                        {adminAvailableBlockedByCapacity && !selectedSession?.payment_requested && (
                          <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--theme-warning-strong)' }}>
                            Capacity is reached for this session, so no more players can be added as Available.
                          </p>
                        )}
                        {adminAvailabilityError && <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--theme-danger)' }}>{adminAvailabilityError}</p>}
                        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
                          {selectedSession?.payment_requested ? 'Cannot change availability after payment request.' : 'Admins can add or modify any player\'s availability.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--theme-border-soft)' }}>
                <strong>Your Selection</strong>
                <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <button onClick={() => handleAvailability('available')} style={voteBtnStyle('available')} disabled={!user || hasSelectedSessionPassed || selectedSession?.payment_requested || !canSelectAvailable || availabilityUpdating}>Available</button>
                  <button onClick={() => handleAvailability('tentative')} style={voteBtnStyle('tentative')} disabled={!user || hasSelectedSessionPassed || selectedSession?.payment_requested || availabilityUpdating}>Tentative</button>
                  <button onClick={() => handleAvailability('not_available')} style={voteBtnStyle('not_available')} disabled={!user || hasSelectedSessionPassed || selectedSession?.payment_requested || availabilityUpdating}>Unavailable</button>
                </div>
                {!user && <p style={{ marginTop: '0.5rem', color: 'var(--theme-danger)' }}>Log in to vote your availability.</p>}
                {user && !selectedSession?.payment_requested && hasSelectedSessionPassed && <p style={{ marginTop: '0.5rem', color: 'var(--theme-warning-strong)', fontSize: '0.875rem' }}>Cannot change availability after event time has passed.</p>}
                {user && selectedSession?.payment_requested && <p style={{ marginTop: '0.5rem', color: 'var(--theme-warning-strong)', fontSize: '0.875rem' }}>Cannot change availability after payment requested.</p>}
                {user && isCapacityReached && selectedStatus !== 'available' && !selectedSession?.payment_requested && !hasSelectedSessionPassed && (
                  <p style={{ marginTop: '0.5rem', color: 'var(--theme-warning-strong)', fontSize: '0.875rem' }}>
                    Maximum capacity reached. Available is temporarily disabled until a slot opens up.
                  </p>
                )}
                {availabilityError && <p style={{ marginTop: '0.5rem', color: 'var(--theme-danger)', fontSize: '0.875rem' }}>{availabilityError}</p>}
              </div>

              {optionSectionEnabled && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--theme-border-soft)' }}>
                  <strong>Event Options</strong>
                  <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                    <button
                      onClick={() => handleOptionSelection('A')}
                      disabled={!user || selectedStatus !== 'available' || hasSelectedSessionPassed || selectedSession?.payment_requested || optionSelectionUpdating}
                      style={{
                        padding: '0.85rem 0.75rem',
                        borderRadius: '0.5rem',
                        minWidth: 0,
                        minHeight: '48px',
                        width: '100%',
                        border: selectedOptionChoice === 'A' ? '2px solid var(--theme-accent)' : '1px solid var(--theme-border)',
                        background: selectedOptionChoice === 'A' ? 'color-mix(in srgb, var(--theme-accent) 12%, white)' : 'var(--theme-surface)',
                        color: 'var(--theme-text)',
                        fontWeight: selectedOptionChoice === 'A' ? 700 : 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                        cursor: (!user || selectedStatus !== 'available' || hasSelectedSessionPassed || selectedSession?.payment_requested || optionSelectionUpdating) ? 'not-allowed' : 'pointer',
                        opacity: (!user || selectedStatus !== 'available' || hasSelectedSessionPassed || selectedSession?.payment_requested) ? 0.6 : 1,
                      }}
                    >
                      {selectedSession.option_a_text}
                    </button>
                    <button
                      onClick={() => handleOptionSelection('B')}
                      disabled={!user || selectedStatus !== 'available' || hasSelectedSessionPassed || selectedSession?.payment_requested || optionSelectionUpdating}
                      style={{
                        padding: '0.85rem 0.75rem',
                        borderRadius: '0.5rem',
                        minWidth: 0,
                        minHeight: '48px',
                        width: '100%',
                        border: selectedOptionChoice === 'B' ? '2px solid var(--theme-accent)' : '1px solid var(--theme-border)',
                        background: selectedOptionChoice === 'B' ? 'color-mix(in srgb, var(--theme-accent) 12%, white)' : 'var(--theme-surface)',
                        color: 'var(--theme-text)',
                        fontWeight: selectedOptionChoice === 'B' ? 700 : 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                        cursor: (!user || selectedStatus !== 'available' || hasSelectedSessionPassed || selectedSession?.payment_requested || optionSelectionUpdating) ? 'not-allowed' : 'pointer',
                        opacity: (!user || selectedStatus !== 'available' || hasSelectedSessionPassed || selectedSession?.payment_requested) ? 0.6 : 1,
                      }}
                    >
                      {selectedSession.option_b_text}
                    </button>
                  </div>
                  {selectedStatus !== 'available' && (
                    <p style={{ marginTop: '0.5rem', color: 'var(--theme-text-muted)', fontSize: '0.875rem' }}>Set your availability to Available to choose an option.</p>
                  )}
                  {(voteSummary?.option_a?.length || voteSummary?.option_b?.length) > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--theme-heading)', marginBottom: '0.35rem' }}>{selectedSession.option_a_text}</div>
                        <div style={{ color: 'var(--theme-text)' }}>{(voteSummary?.option_a || []).length > 0 ? formatDisplayNames(voteSummary.option_a || []) : 'No selections yet'}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--theme-heading)', marginBottom: '0.35rem' }}>{selectedSession.option_b_text}</div>
                        <div style={{ color: 'var(--theme-text)' }}>{(voteSummary?.option_b || []).length > 0 ? formatDisplayNames(voteSummary.option_b || []) : 'No selections yet'}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedSession?.payment_requested && user && isUserAvailable && voteSummary?.available?.length > 0 && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--theme-warning-soft)', borderRadius: '0.75rem', border: '1px solid color-mix(in srgb, var(--theme-warning) 36%, white)' }}>
                  <strong style={{ color: 'var(--theme-warning-strong)' }}>Payment Request</strong>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--theme-warning-strong)' }}>
                    Total Cost £ {selectedSession.session_cost != null ? Number(selectedSession.session_cost).toFixed(2) : '0.00'}
                  </p>
                  {hasPaidByBankDetails && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--theme-surface)', borderRadius: '0.5rem', border: '1px solid color-mix(in srgb, var(--theme-warning) 26%, white)' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--theme-heading)', marginBottom: '0.5rem' }}>Bank Details</div>
                      <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem', color: 'var(--theme-text)' }}>
                        <div><strong>Account Holder:</strong> {paidByBankDetails.full_name || 'Unknown User'}</div>
                        <div><strong>Bank Name:</strong> {paidByBankDetails.bank_name}</div>
                        <div><strong>Sort Code:</strong> {paidByBankDetails.sort_code}</div>
                        <div><strong>Account Number:</strong> {paidByBankDetails.account_number}</div>
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--theme-surface)', borderRadius: '0.5rem', border: '1px solid color-mix(in srgb, var(--theme-warning) 26%, white)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id="payment-checkbox"
                        checked={payments[user.email] || false}
                        onChange={(e) => handlePaymentConfirmation(e.target.checked)}
                        disabled={paymentUpdatePending}
                        style={{ width: '18px', height: '18px', cursor: paymentUpdatePending ? 'wait' : 'pointer' }}
                      />
                      <label htmlFor="payment-checkbox" style={{ fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>
                        {selectedSession.session_cost != null && availablePlayersForPayment > 0 ? (
                          <>Paid £{(selectedSession.session_cost / availablePlayersForPayment).toFixed(2)} to {selectedSession.paid_by_name || selectedSession.paid_by || 'Unknown User'}</>
                        ) : (
                          'Confirm payment made'
                        )}
                      </label>
                    </div>
                    {paymentUpdatePending && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
                        Updating payment status...
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--theme-border-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <strong>Member Availability</strong>
                  {!selectedSession?.payment_requested && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: '700', color: sessionRemainingSlots > 0 ? 'var(--theme-success-strong)' : 'var(--theme-warning-strong)' }}>
                    <span style={{ display: 'inline-flex', width: '1.5rem', height: '1.5rem', borderRadius: '999px', alignItems: 'center', justifyContent: 'center', background: sessionRemainingSlots > 0 ? 'var(--theme-success-soft)' : 'var(--theme-warning-soft)', border: `1px solid ${sessionRemainingSlots > 0 ? 'color-mix(in srgb, var(--theme-success) 28%, white)' : 'color-mix(in srgb, var(--theme-warning) 28%, white)'}` }}>+</span>
                    <span>{sessionRemainingSlots} slot{sessionRemainingSlots === 1 ? '' : 's'} available</span>
                  </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '0.75rem' }}>
                  <div style={{ border: '1px solid color-mix(in srgb, var(--theme-success) 28%, white)', borderRadius: '0.75rem', padding: '0.55rem', background: 'var(--theme-success-soft)' }}>
                    <div style={{ fontSize: '2rem', lineHeight: 1, fontWeight: '800', marginBottom: '0.25rem', color: 'var(--theme-success-strong)' }}>
                      {(voteSummary?.available || []).length}
                      {selectedSession?.payment_requested && (voteSummary?.available || []).length > 0 && (
                      <span style={{ fontSize: '0.750rem', color: 'var(--theme-success-strong)', fontWeight: '500'}}>
                        &nbsp;&nbsp;(Paid {paidAvailablePlayersCount})
                      </span>
                    )}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '0.35rem', color: 'var(--theme-success-strong)' }}>Available</div>
                    <div style={{ marginTop: '0.5rem', paddingTop: '1rem' }}>
                      {(voteSummary?.available || []).map((n, idx) => {
                        const userEmail = voteSummary?.user_emails?.[n] || n
                        const hasPaid = payments[userEmail] || false
                        return (
                          <div key={`${n}-${idx}`} style={{ marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: 'var(--theme-text)' }}>{getDisplayFirstName(n)}</span>
                              {selectedSession?.payment_requested && hasPaid && <span style={{ color: 'var(--theme-success)', fontWeight: 'bold', fontSize: '1rem' }} title="Payment confirmed">✓</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ border: '1px solid color-mix(in srgb, var(--theme-warning) 28%, white)', borderRadius: '0.75rem', padding: '0.55rem', background: 'var(--theme-warning-soft)' }}>
                    <div style={{ fontSize: '2rem', lineHeight: 1, fontWeight: '800', marginBottom: '0.25rem', color: 'var(--theme-warning-strong)' }}>
                      {(voteSummary?.tentative || []).length}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '0.35rem', color: 'var(--theme-warning-strong)' }}>Tentative</div>
                    <div style={{ marginTop: '0.5rem', paddingTop: '1rem' }}>
                      {(voteSummary?.tentative || []).map((n, idx) => (
                        <div key={`${n}-${idx}`} style={{ marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--theme-text)' }}>{getDisplayFirstName(n)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: '1px solid color-mix(in srgb, var(--theme-danger) 28%, white)', borderRadius: '0.75rem', padding: '0.55rem', background: 'var(--theme-danger-soft)' }}>
                    <div style={{ fontSize: '2rem', lineHeight: 1, fontWeight: '800', marginBottom: '0.25rem', color: 'var(--theme-danger-strong)' }}>
                      {(voteSummary?.not_available || []).length}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '0.35rem', color: 'var(--theme-danger-strong)' }}>Unavailable</div>
                    <div style={{ marginTop: '0.5rem', paddingTop: '1rem' }}>
                      {(voteSummary?.not_available || []).map((n, idx) => (
                        <div key={`${n}-${idx}`} style={{ marginBottom: '0.25rem' }}>
                          <span style={{ color: 'var(--theme-text)' }}>{getDisplayFirstName(n)}</span>
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
