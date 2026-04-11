import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiUrl } from '../api'
import '../styles/Admin.css'
import Reports from './Reports'
import { validateAdminTab } from '../utils/routeValidation'

export default function Admin({ user, loading }) {
  const navigate = useNavigate()
  const { tab: routeTab } = useParams()
  const token = localStorage.getItem('token')
  const isSuperAdmin = user?.email === 'super@admin.com'
  const adminTabs = [
    { value: 'events', label: 'Events' },
    { value: 'users', label: 'Users' },
    { value: 'expense', label: 'Expense' },
    { value: 'reports', label: 'Reports' },
    ...(isSuperAdmin ? [{ value: 'notifications', label: 'Notifications' }] : []),
  ]

  // Admin check: user_type is 'admin' OR email is 'super@admin.com'
  const isAdmin = user && (user.user_type === 'admin' || user.email === 'super@admin.com')

  const [message, setMessage] = useState('')
  
  // Route validation
  const validatedTab = validateAdminTab(routeTab)
  const activeTab = validatedTab || 'events'
  const setActiveTab = (tab) => navigate(`/admin/${tab}`)

  // Events
  const [events, setEvents] = useState([])
  const [editingEventId, setEditingEventId] = useState(null)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventImageUrl, setEventImageUrl] = useState('')
  const [eventYoutubeUrl, setEventYoutubeUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  // Calendar Events
  const [calendarEvents, setCalendarEvents] = useState([])
  const [editingCalendarEventId, setEditingCalendarEventId] = useState(null)
  const [calendarEventDate, setCalendarEventDate] = useState('')
  const [calendarEventTime, setCalendarEventTime] = useState('21:00')
  const [calendarEventLocation, setCalendarEventLocation] = useState('Toryglen')
  const [calendarEventEventType, setCalendarEventEventType] = useState('practice')
  const [calendarEventTitle, setCalendarEventTitle] = useState('Session')
  const [calendarEventDescription, setCalendarEventDescription] = useState('')
  const [calendarEventImageUrl, setCalendarEventImageUrl] = useState('')
  const [calendarEventYoutubeUrl, setCalendarEventYoutubeUrl] = useState('')
  const [calendarEventOptionAText, setCalendarEventOptionAText] = useState('')
  const [calendarEventOptionBText, setCalendarEventOptionBText] = useState('')
  const [calendarEventSessionCost, setCalendarEventSessionCost] = useState('')
  const [calendarEventCostType, setCalendarEventCostType] = useState('Total')
  const [calendarEventPaidBy, setCalendarEventPaidBy] = useState('')
  const [calendarEventMaximumCapacity, setCalendarEventMaximumCapacity] = useState('18')
  const [calendarEventInlineStatus, setCalendarEventInlineStatus] = useState('')
  const [isSubmittingCalendarEvent, setIsSubmittingCalendarEvent] = useState(false)
  const [practiceListTab, setPracticeListTab] = useState('upcoming')

  // Users
  const [users, setUsers] = useState([])
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingUserName, setEditingUserName] = useState('')
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userTypeStatusByEmail, setUserTypeStatusByEmail] = useState({})
  const [paymentModeStatusByEmail, setPaymentModeStatusByEmail] = useState({})

  // Expenses
  const [expenses, setExpenses] = useState([])
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('')
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all')
  const [expensePaidByFilter, setExpensePaidByFilter] = useState('all')

  // Notifications
  const [notificationSettings, setNotificationSettings] = useState([])
  const [notificationMeta, setNotificationMeta] = useState({ target_audiences: [], notification_types: [] })
  const [notificationSaving, setNotificationSaving] = useState('')
  const [notificationSaveStatusByType, setNotificationSaveStatusByType] = useState({})

  // Track which data has been loaded to prevent unnecessary reloads
  const [loadedTabs, setLoadedTabs] = useState(new Set())

  const notificationPreviewSamples = {
    practice: {
      session_id: '123',
      date: 'Thursday, 20th March 2026',
      date_iso: '2026-03-20',
      time: '7:30 PM',
      location: 'Glasgow Green',
      event_name: 'Practice - Session',
      event_type: 'practice',
      event_type_label: 'Practice',
      event_title: 'Session',
      author_name: '',
      content: '',
      content_preview: '',
      time_suffix: ' at 7:30 PM',
      location_suffix: ' at Glasgow Green',
      location_comma_suffix: ', Glasgow Green',
      time_line: '🕐 7:30 PM\n',
      location_line: '📍 Glasgow Green\n',
    },
    forum_post: {
      date: '',
      time: '',
      location: '',
      event_name: '',
      author_name: 'Argha Banerjee',
      content: 'Please confirm who can join training this Thursday and whether we should arrange bibs.',
      content_preview: 'Please confirm who can join training this Thursday and whether we should arrange bibs.',
      time_suffix: '',
      location_suffix: '',
      location_comma_suffix: '',
      time_line: '',
      location_line: '',
    },
    payment_request: {
      session_id: '123',
      date: 'Thursday, 2nd April 2026',
      date_iso: '2026-04-02',
      time: '8:00 PM',
      location: 'Scotstoun Sports Campus',
      event_name: 'Practice - Session',
      event_type: 'practice',
      event_type_label: 'Practice',
      event_title: 'Session',
      author_name: '',
      content: '',
      content_preview: '',
      time_suffix: ' at 8:00 PM',
      location_suffix: ' at Scotstoun Sports Campus',
      location_comma_suffix: ', Scotstoun Sports Campus',
      time_line: '🕐 8:00 PM\n',
      location_line: '📍 Scotstoun Sports Campus\n',
    },
    payment_confirmed: {
      session_id: '123',
      date: 'Thursday, 2nd April 2026',
      date_iso: '2026-04-02',
      time: '8:00 PM',
      location: 'Scotstoun Sports Campus',
      event_name: 'Practice - Session',
      event_type: 'practice',
      event_type_label: 'Practice',
      event_title: 'Session',
      member_name: 'Rahim Uddin',
      full_name: 'Rahim Uddin',
      time_suffix: ' at 8:00 PM',
      location_suffix: ' at Scotstoun Sports Campus',
      location_comma_suffix: ', Scotstoun Sports Campus',
      time_line: '🕐 8:00 PM\n',
      location_line: '📍 Scotstoun Sports Campus\n',
    },
    pending_payment_reminder: {
      session_id: '123',
      date: 'Thursday, 2nd April 2026',
      date_iso: '2026-04-02',
      time: '8:00 PM',
      location: 'Scotstoun Sports Campus',
      event_name: 'Practice - Session',
      event_type: 'practice',
      event_type_label: 'Practice',
      event_title: 'Session',
      payments_link: 'https://glasgow-bengali-fc.vercel.app/user/payments',
      time_suffix: ' at 8:00 PM',
      location_suffix: ' at Scotstoun Sports Campus',
      location_comma_suffix: ', Scotstoun Sports Campus',
      time_line: '🕐 8:00 PM\n',
      location_line: '📍 Scotstoun Sports Campus\n',
    },
    session_capacity_reached: {
      session_id: '123',
      date: 'Friday, 10th April 2026',
      date_iso: '2026-04-10',
      time: '7:00 PM',
      location: 'Glasgow Green',
      event_name: 'Practice - Session',
      event_type: 'practice',
      event_type_label: 'Practice',
      event_title: 'Session',
      maximum_capacity: '18',
      available_count: '18',
      remaining_slots: '0',
      time_suffix: ' at 7:00 PM',
      location_suffix: ' at Glasgow Green',
      location_comma_suffix: ', Glasgow Green',
      time_line: '🕐 7:00 PM\n',
      location_line: '📍 Glasgow Green\n',
    },
    practice_slot_available: {
      session_id: '123',
      date: 'Sunday, 12th April 2026',
      date_iso: '2026-04-12',
      time: '8:30 PM',
      location: 'Scotstoun Sports Campus',
      event_name: 'Practice - Session',
      event_type: 'practice',
      event_type_label: 'Practice',
      event_title: 'Session',
      maximum_capacity: '20',
      available_count: '14',
      remaining_slots: '6',
      time_suffix: ' at 8:30 PM',
      location_suffix: ' at Scotstoun Sports Campus',
      location_comma_suffix: ', Scotstoun Sports Campus',
      time_line: '🕐 8:30 PM\n',
      location_line: '📍 Scotstoun Sports Campus\n',
    },
    welcome_signup: {
      full_name: 'New Member',
      club_name: 'Glasgow Bengali FC',
    },
  }

  const notificationVariableMap = {
    practice: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{date_iso}}', '{{time}}', '{{location}}', '{{session_id}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    forum_post: ['{{author_name}}', '{{content}}', '{{content_preview}}'],
    payment_request: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{date_iso}}', '{{time}}', '{{location}}', '{{session_id}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    payment_confirmed: ['{{member_name}}', '{{full_name}}', '{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{date_iso}}', '{{time}}', '{{location}}', '{{session_id}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    pending_payment_reminder: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{payments_link}}', '{{date}}', '{{date_iso}}', '{{time}}', '{{location}}', '{{session_id}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    session_capacity_reached: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{date_iso}}', '{{time}}', '{{location}}', '{{session_id}}', '{{maximum_capacity}}', '{{available_count}}', '{{remaining_slots}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    practice_slot_available: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{date_iso}}', '{{time}}', '{{location}}', '{{session_id}}', '{{maximum_capacity}}', '{{available_count}}', '{{remaining_slots}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    welcome_signup: ['{{full_name}}', '{{club_name}}'],
  }

  const expenseCategoryOptions = [
    'Ground',
    'Equipment',
    'Transport',
    'Refreshments',
    'Tournament',
    'Referee',
    'Kit',
    'Medical',
    'Administration',
    'Other',
  ]

  const renderNotificationPreview = (template, notifType) => {
    const context = notificationPreviewSamples[notifType] || {}
    let rendered = template || ''
    Object.entries(context).forEach(([key, value]) => {
      rendered = rendered.replaceAll(`{{${key}}}`, value ?? '')
    })
    return rendered
  }

  const getNotificationVariables = (notifType) => notificationVariableMap[notifType] || []

  useEffect(() => {
    // Wait for loading to complete before checking authentication
    if (loading) return
    
    if (!user) {
      navigate('/login')
    } else if (!isAdmin) {
      // Non-admin user trying to access admin page - redirect to home
      navigate('/')
    }
  }, [user, loading, navigate, isAdmin])

  useEffect(() => {
    if (loading || !user || !isAdmin) return

    if (!routeTab) return

    const isValidTab = Boolean(validateAdminTab(routeTab))
    if (!isValidTab) {
      setMessage(`Invalid admin tab: "${routeTab}". Redirecting to events tab.`)
      navigate('/admin/events', { replace: true })
      const timer = setTimeout(() => setMessage(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [routeTab, loading, user, isAdmin, navigate])

  const loadEvents = async () => {
    const res = await fetch(apiUrl('/api/matches'))
    if (res.ok) setEvents(await res.json())
  }

  const loadCalendarEvents = async () => {
    const res = await fetch(apiUrl('/api/calendar/events'))
    if (res.ok) setCalendarEvents(await res.json())
  }

  const loadUsers = async () => {
    try {
      const res = await fetch(apiUrl('/api/users'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      } else {
        const error = await res.json().catch(() => ({}))
        console.error('Failed to load users:', error)
        setMessage(error?.detail || 'Failed to load users')
      }
    } catch (err) {
      console.error('Error loading users:', err)
      setMessage('Error loading users')
    }
  }

  const loadExpenses = async () => {
    try {
      const res = await fetch(apiUrl('/api/expenses'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setExpenses(await res.json())
      } else {
        const error = await res.json().catch(() => ({}))
        setMessage(error?.detail || 'Failed to load expenses')
      }
    } catch (err) {
      console.error('Error loading expenses:', err)
      setMessage('Error loading expenses')
    }
  }

  const refreshTabData = (tabName) => {
    if (tabName === 'events') {
      loadCalendarEvents()
      loadUsers()
    }
    else if (tabName === 'users') loadUsers()
    else if (tabName === 'expense') {
      loadExpenses()
      loadUsers()
    }
    else if (tabName === 'notifications' && isSuperAdmin) loadNotificationSettings()
  }

  const loadNotificationSettings = async () => {
    try {
      const [settingsRes, metaRes] = await Promise.all([
        fetch(apiUrl('/api/admin/notification-settings'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl('/api/admin/notification-settings/meta'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const settingsData = await settingsRes.json().catch(() => [])
      if (!settingsRes.ok) {
        setMessage(settingsData?.detail || 'Failed to load notification settings')
        return
      }
      setNotificationSettings(settingsData)

      if (metaRes.ok) {
        const metaData = await metaRes.json()
        setNotificationMeta(metaData)
      }
    } catch (err) {
      console.error('Error loading notification settings:', err)
      setMessage('Error loading notification settings')
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    
    // Only load data for the active tab if not already loaded
    if (!loadedTabs.has(activeTab)) {
      const newLoadedTabs = new Set(loadedTabs)
      let didLoadTab = false
      
      if (activeTab === 'events') {
        loadCalendarEvents()
        loadUsers()
        newLoadedTabs.add('events')
        didLoadTab = true
      } else if (activeTab === 'users') {
        loadUsers()
        newLoadedTabs.add('users')
        didLoadTab = true
      } else if (activeTab === 'expense') {
        loadExpenses()
        loadUsers()
        newLoadedTabs.add('expense')
        didLoadTab = true
      } else if (activeTab === 'notifications' && isSuperAdmin) {
        loadNotificationSettings()
        newLoadedTabs.add('notifications')
        didLoadTab = true
      }
      
      if (didLoadTab) {
        setLoadedTabs(newLoadedTabs)
      }
    }
  }, [isAdmin, activeTab, isSuperAdmin, loadedTabs])

  const handleNotificationFieldChange = (notifType, field, value) => {
    setNotificationSettings((current) =>
      current.map((setting) =>
        setting.notif_type === notifType ? { ...setting, [field]: value } : setting
      )
    )
  }

  const handleSaveNotificationSetting = async (notifType) => {
    const setting = notificationSettings.find((item) => item.notif_type === notifType)
    if (!setting) return

    setNotificationSaving(notifType)
    try {
      const res = await fetch(apiUrl(`/api/admin/notification-settings/${notifType}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: setting.display_name,
          description: setting.description || '',
          app_enabled: setting.app_enabled,
          email_enabled: setting.email_enabled,
          whatsapp_enabled: setting.whatsapp_enabled,
          target_audience: setting.target_audience,
          app_template: setting.app_template,
          email_subject: setting.email_subject,
          email_template: setting.email_template,
          whatsapp_template: setting.whatsapp_template,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data?.detail || 'Failed to save notification setting')
        return
      }
      setNotificationSettings((current) =>
        current.map((item) => (item.notif_type === notifType ? data : item))
      )
      setNotificationSaveStatusByType((current) => ({
        ...current,
        [notifType]: 'Template saved successfully!',
      }))
      setMessage('Notification setting saved.')
    } catch (err) {
      console.error('Error saving notification setting:', err)
      setMessage('Error saving notification setting')
    } finally {
      setNotificationSaving('')
    }
  }

  const handleResetNotificationSetting = async (notifType) => {
    setNotificationSaving(notifType)
    try {
      const res = await fetch(apiUrl(`/api/admin/notification-settings/${notifType}/reset`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data?.detail || 'Failed to reset notification setting')
        return
      }
      setNotificationSettings((current) =>
        current.map((item) => (item.notif_type === notifType ? data : item))
      )
      setNotificationSaveStatusByType((current) => {
        const next = { ...current }
        delete next[notifType]
        return next
      })
      setMessage('Notification setting reset to defaults.')
    } catch (err) {
      console.error('Error resetting notification setting:', err)
      setMessage('Error resetting notification setting')
    } finally {
      setNotificationSaving('')
    }
  }

  const resetEventForm = () => {
    setEditingEventId(null)
    setEventName('')
    setEventDate('')
    setEventTime('')
  }

  const resetCalendarEventForm = () => {
    setEditingCalendarEventId(null)
    setCalendarEventDate('')
    setCalendarEventTime('21:00')
    setCalendarEventLocation('Toryglen')
    setCalendarEventEventType('practice')
    setCalendarEventTitle('Session')
    setCalendarEventDescription('')
    setCalendarEventImageUrl('')
    setCalendarEventYoutubeUrl('')
    setCalendarEventOptionAText('')
    setCalendarEventOptionBText('')
    setCalendarEventSessionCost('')
    setCalendarEventCostType('Total')
    setCalendarEventPaidBy('')
    setCalendarEventMaximumCapacity('18')
    setCalendarEventInlineStatus('')
  }

  const resetExpenseForm = () => {
    setEditingExpenseId(null)
    setExpenseTitle('')
    setExpenseAmount('')
    setExpensePaidBy('')
    setExpenseDate('')
    setExpenseCategory('')
    setExpensePaymentMethod('')
    setExpenseDescription('')
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(apiUrl('/api/upload-image'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Upload failed')
      setCalendarEventImageUrl(data.image_url)
    } catch (err) {
      setMessage(String(err))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitEvent = async (e) => {
    e.preventDefault()
    const payload = {
      name: eventName,
      date: eventDate,
      time: eventTime,
      location: eventLocation,
      description: eventDescription,
      image_url: eventImageUrl,
      youtube_url: eventYoutubeUrl,
    }
    const res = await fetch(apiUrl(editingEventId ? `/api/matches/${editingEventId}` : '/api/matches'), {
      method: editingEventId ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to save event')
      return
    }
    setMessage(editingEventId ? 'Event updated.' : 'Event created.')
    resetEventForm()
    refreshTabData('event')
  }

  const handleEditEvent = (ev) => {
    setActiveTab('event')
    setEditingEventId(ev.id)
    setEventName(ev.name || '')
    setEventDate(ev.date || '')
    setEventTime(ev.time || '')
    setEventLocation(ev.location || '')
    setEventDescription(ev.description || '')
    setEventImageUrl(ev.image_url || '')
    setEventYoutubeUrl(ev.youtube_url || '')
  }

  const handleDeleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return
    const res = await fetch(apiUrl(`/api/matches/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMessage(data?.detail || 'Failed to delete event')
      return
    }
    setMessage('Event deleted.')
    refreshTabData('event')
  }

  const handleSubmitCalendarEvent = async (e) => {
    e.preventDefault()
    const isEditingPractice = Boolean(editingCalendarEventId)
    const trimmedOptionA = calendarEventOptionAText.trim()
    const trimmedOptionB = calendarEventOptionBText.trim()

    if ((trimmedOptionA && !trimmedOptionB) || (!trimmedOptionA && trimmedOptionB)) {
      setMessage('')
      setIsSubmittingCalendarEvent(false)
      return
    }

    setCalendarEventInlineStatus(editingCalendarEventId ? 'Saving changes...' : 'Saving new event...')
    setIsSubmittingCalendarEvent(true)

    const payload = {
      date: calendarEventDate,
      time: calendarEventTime,
      location: calendarEventLocation,
      event_type: calendarEventEventType,
      event_title: calendarEventTitle,
      description: calendarEventDescription,
      image_url: calendarEventImageUrl || null,
      youtube_url: calendarEventYoutubeUrl || null,
      option_a_text: trimmedOptionA || null,
      option_b_text: trimmedOptionB || null,
      session_cost: calendarEventSessionCost !== '' ? parseFloat(calendarEventSessionCost) : null,
      cost_type: calendarEventCostType || 'Total',
      paid_by: calendarEventPaidBy || null,
      maximum_capacity: calendarEventMaximumCapacity ? parseInt(calendarEventMaximumCapacity, 10) : 100,
    }

    let res
    if (editingCalendarEventId) {
      res = await fetch(apiUrl(`/api/calendar/events/id/${editingCalendarEventId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch(apiUrl('/api/calendar/events'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to save event')
      setCalendarEventInlineStatus('')
      return
    }
    setMessage(isEditingPractice ? 'Event updated.' : 'Event created.')
    resetCalendarEventForm()
    setCalendarEventInlineStatus(isEditingPractice ? 'Record updated successfully!' : 'New event added!')
    refreshTabData('events')
    setTimeout(() => {
      setCalendarEventInlineStatus((currentStatus) => (
        currentStatus === (isEditingPractice ? 'Record updated successfully!' : 'New event added!') ? '' : currentStatus
      ))
    }, 2500)
  }

  const hasPartialPracticeOptions = (calendarEventOptionAText.trim() && !calendarEventOptionBText.trim()) || (!calendarEventOptionAText.trim() && calendarEventOptionBText.trim())
  const showPracticeOptionInputs = calendarEventEventType === 'match' || calendarEventEventType === 'social'
  const practiceOptionInputStyle = {
    width: '100%',
    background: hasPartialPracticeOptions ? '#fff7ed' : undefined,
    border: hasPartialPracticeOptions ? '1px solid #f59e0b' : undefined,
  }

  const handleSubmitCalendarEventWithReset = async (e) => {
    try {
      await handleSubmitCalendarEvent(e)
    } finally {
      setIsSubmittingCalendarEvent(false)
    }
  }

  const handleEditCalendarEvent = (s) => {
    setActiveTab('events')
    setCalendarEventInlineStatus('')
    setEditingCalendarEventId(s.id)
    setCalendarEventDate(s.date || '')
    setCalendarEventTime(s.time || '')
    setCalendarEventLocation(s.location || '')
    setCalendarEventEventType(s.event_type || 'practice')
    setCalendarEventTitle(s.event_title || 'Session')
    setCalendarEventDescription(s.description || '')
    setCalendarEventImageUrl(s.image_url || '')
    setCalendarEventYoutubeUrl(s.youtube_url || '')
    setCalendarEventOptionAText(s.option_a_text || '')
    setCalendarEventOptionBText(s.option_b_text || '')
    setCalendarEventSessionCost(s.session_cost != null ? String(s.session_cost) : '')
    setCalendarEventCostType(s.cost_type || 'Total')
    setCalendarEventPaidBy(s.paid_by || '')
    setCalendarEventMaximumCapacity((s.maximum_capacity || 100).toString())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteCalendarEvent = async (sessionId) => {
    if (!confirm('Delete this event?')) return
    const res = await fetch(apiUrl(`/api/calendar/events/id/${sessionId}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to delete event')
      return
    }
    setMessage('Event deleted.')
    if (editingCalendarEventId === sessionId) resetCalendarEventForm()
    refreshTabData('events')
  }

  const handleSubmitExpense = async (e) => {
    e.preventDefault()
    const payload = {
      title: expenseTitle,
      amount: parseFloat(expenseAmount),
      paid_by: expensePaidBy || null,
      expense_date: expenseDate,
      category: expenseCategory || null,
      payment_method: expensePaymentMethod || null,
      description: expenseDescription || null,
    }
    const res = await fetch(apiUrl(editingExpenseId ? `/api/expenses/${editingExpenseId}` : '/api/expenses'), {
      method: editingExpenseId ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to save expense')
      return
    }
    setMessage(editingExpenseId ? 'Expense updated.' : 'Expense created.')
    resetExpenseForm()
    refreshTabData('expense')
  }

  const handleEditExpense = (expense) => {
    setActiveTab('expense')
    setEditingExpenseId(expense.id)
    setExpenseTitle(expense.title || '')
    setExpenseAmount(expense.amount != null ? String(expense.amount) : '')
    setExpensePaidBy(expense.paid_by || '')
    setExpenseDate(expense.expense_date || '')
    setExpenseCategory(expense.category || '')
    setExpensePaymentMethod(expense.payment_method || '')
    setExpenseDescription(expense.description || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Delete this expense?')) return
    const res = await fetch(apiUrl(`/api/expenses/${expenseId}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to delete expense')
      return
    }
    setMessage('Expense deleted.')
    if (editingExpenseId === expenseId) resetExpenseForm()
    refreshTabData('expense')
  }

  const handleUpdateUserType = async (email, userType) => {
    const res = await fetch(apiUrl(`/api/users/${encodeURIComponent(email)}/type`), {
      method: 'PATCH',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_type: userType })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to update user type')
      return
    }
    setUserTypeStatusByEmail((prev) => ({
      ...prev,
      [email]: userType === 'admin'
        ? 'User type updated to Admin'
        : 'User type updated to Member'
    }))
    refreshTabData('users')
    // Clear status message after 3 seconds
    setTimeout(() => {
      setUserTypeStatusByEmail((prev) => {
        const newStatus = { ...prev }
        delete newStatus[email]
        return newStatus
      })
    }, 3000)
  }

  const handleSaveUserName = async (email) => {
    if (!editingUserName.trim()) {
      alert('Name cannot be empty')
      return
    }
    
    const res = await fetch(apiUrl(`/api/users/${encodeURIComponent(email)}/name`), {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ full_name: editingUserName.trim() })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to update user name')
      return
    }
    setMessage('User name updated successfully.')
    setEditingUserId(null)
    setEditingUserName('')
    refreshTabData('users')
  }

  const handleUpdateUserPaymentMode = async (email, paymentMode) => {
    const res = await fetch(apiUrl(`/api/users/${encodeURIComponent(email)}/payment-mode`), {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ payment_mode: paymentMode })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to update user payment mode')
      return
    }
    setPaymentModeStatusByEmail((prev) => ({
      ...prev,
      [email]: `Payment mode updated to ${paymentMode}`
    }))
    refreshTabData('users')
    // Clear status message after 3 seconds
    setTimeout(() => {
      setPaymentModeStatusByEmail((prev) => {
        const newStatus = { ...prev }
        delete newStatus[email]
        return newStatus
      })
    }, 3000)
  }

  const handleDeleteUser = async (email) => {
    if (!confirm(`Delete user ${email}? This will also delete all their posts, comments, and likes.`)) return
    const res = await fetch(apiUrl(`/api/users/${encodeURIComponent(email)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to delete user')
      return
    }
    setMessage('User deleted.')
    refreshTabData('users')
  }

  const filteredUsers = [...users]
    .filter((u) => !u.is_deleted)
    .filter((u) => (u.full_name || '').toLowerCase().includes(userSearchTerm.trim().toLowerCase()))
    .sort((a, b) => {
      const aLastLogin = a.last_login ? new Date(a.last_login).getTime() : 0
      const bLastLogin = b.last_login ? new Date(b.last_login).getTime() : 0
      return bLastLogin - aLastLogin
    })

  const formatBirthday = (birthday) => {
    if (!birthday) return 'Not Set'
    const parsedDate = new Date(`${birthday}T00:00:00`)
    if (Number.isNaN(parsedDate.getTime())) return 'Not Set'

    const day = parsedDate.getDate()
    const month = parsedDate.toLocaleString('en-GB', { month: 'long' })
    const suffix = (day % 10 === 1 && day % 100 !== 11)
      ? 'st'
      : (day % 10 === 2 && day % 100 !== 12)
        ? 'nd'
        : (day % 10 === 3 && day % 100 !== 13)
          ? 'rd'
          : 'th'

    return `${day}${suffix} ${month}`
  }

  const todayAtMidnight = new Date()
  todayAtMidnight.setHours(0, 0, 0, 0)

  const hasUpcomingBirthday = (birthday) => {
    if (!birthday) return false
    const parsedDate = new Date(`${birthday}T00:00:00`)
    if (Number.isNaN(parsedDate.getTime())) return false

    const nextBirthday = new Date(todayAtMidnight)
    nextBirthday.setMonth(parsedDate.getMonth(), parsedDate.getDate())
    nextBirthday.setHours(0, 0, 0, 0)

    if (nextBirthday < todayAtMidnight) {
      nextBirthday.setFullYear(nextBirthday.getFullYear() + 1)
    }

    const diffInDays = Math.ceil((nextBirthday.getTime() - todayAtMidnight.getTime()) / (1000 * 60 * 60 * 24))
    return diffInDays >= 0 && diffInDays <= 30
  }

  const upcomingBirthdaysCount = users.filter((u) => hasUpcomingBirthday(u.birthday)).length

  const eventTypeOptions = [
    { value: 'practice', label: 'Practice' },
    { value: 'match', label: 'Match' },
    { value: 'social', label: 'Social' },
    { value: 'others', label: 'Others' },
  ]

  const formatEventTypeLabel = (value) => {
    return eventTypeOptions.find((option) => option.value === value)?.label || 'Practice'
  }

  const upcomingCalendarEvents = calendarEvents
    .filter((s) => new Date(`${s.date}T00:00:00`) >= todayAtMidnight)
    .sort((a, b) => {
      const dateCompare = new Date(`${a.date}T00:00:00`) - new Date(`${b.date}T00:00:00`)
      if (dateCompare !== 0) return dateCompare
      return (a.id || 0) - (b.id || 0)
    })

  const pastCalendarEvents = calendarEvents
    .filter((s) => new Date(`${s.date}T00:00:00`) < todayAtMidnight)
    .sort((a, b) => {
      const dateCompare = new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`)
      if (dateCompare !== 0) return dateCompare
      return (b.id || 0) - (a.id || 0)
    })

  const sortedExpenses = [...expenses].sort((a, b) => {
    const dateCompare = new Date(`${b.expense_date}T00:00:00`) - new Date(`${a.expense_date}T00:00:00`)
    if (dateCompare !== 0) return dateCompare
    return (b.id || 0) - (a.id || 0)
  })

  const searchableExpenseText = (expense) => [
    expense.title,
    expense.description,
    expense.category,
    expense.payment_method,
    expense.paid_by_name,
    expense.paid_by,
    expense.expense_date,
    expense.practice_session_date,
    expense.linked_practice_time,
    expense.linked_practice_location,
    expense.source,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const filteredExpenses = sortedExpenses.filter((expense) => {
    const matchesSearch = !expenseSearchTerm.trim() || searchableExpenseText(expense).includes(expenseSearchTerm.trim().toLowerCase())
    const matchesCategory = expenseCategoryFilter === 'all' || (expense.category || '') === expenseCategoryFilter
    const matchesPaidBy = expensePaidByFilter === 'all' || (expense.paid_by || '') === expensePaidByFilter
    return matchesSearch && matchesCategory && matchesPaidBy
  })

  const filteredExpenseTotal = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const availableExpenseCategories = Array.from(new Set(sortedExpenses.map((expense) => expense.category).filter(Boolean)))

  if (!isAdmin) {
    return (
      <div className="container">
        <h2>Admin</h2>
        <p>{message || 'Loading...'}</p>
      </div>
    )
  }

  return (
    <div className="container">
      <h2>Admin</h2>
      {message && <p>{message}</p>}

      <div className="admin-menu-mobile">
        <select
          className="admin-menu-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
        >
          {adminTabs.map((tab) => (
            <option key={tab.value} value={tab.value}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-menu-tabs">
        {adminTabs.map((tab) => (
          <button
            key={tab.value}
            className={`admin-menu-tab ${activeTab === tab.value ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <style>{`
        .admin-mobile-action-group {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .admin-mobile-action-btn {
          min-width: 88px;
          justify-content: center;
        }
        .admin-mobile-action-icon {
          display: none;
        }
        .admin-card-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        .admin-card-header-main {
          min-width: 0;
          flex: 1;
        }
        @media (max-width: 640px) {
          .admin-mobile-action-group {
            flex-wrap: nowrap;
            flex-shrink: 0;
            margin-left: auto;
          }
          .admin-mobile-action-btn {
            min-width: 40px;
            width: 40px;
            height: 40px;
            padding: 0;
            border-radius: 0.625rem;
            flex: 0 0 40px;
          }
          .admin-mobile-action-text {
            display: none;
          }
          .admin-mobile-action-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>

      {activeTab === 'events' && (
        <>
          <form onSubmit={handleSubmitCalendarEventWithReset} style={{ display: 'grid', gap: '1rem', padding: '1.5rem', background: 'white', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
            <div>
              <label>Event Type</label>
              <select value={calendarEventEventType} onChange={(e) => {
                const nextEventType = e.target.value
                setCalendarEventEventType(nextEventType)
                if (nextEventType !== 'practice') {
                  setCalendarEventTitle('')
                }
                if (nextEventType !== 'match' && nextEventType !== 'social') {
                  setCalendarEventOptionAText('')
                  setCalendarEventOptionBText('')
                }
              }} style={{ width: '100%' }}>
                {eventTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Event Title</label>
              <input value={calendarEventTitle} onChange={(e) => setCalendarEventTitle(e.target.value.slice(0, 30))} maxLength={30} placeholder="Enter event title" style={{ width: '100%' }} />
            </div>
            <div>
              <label>Date</label>
              <input type="date" value={calendarEventDate} onChange={(e) => setCalendarEventDate(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div>
              <label>Time</label>
              <input type="time" value={calendarEventTime} onChange={(e) => setCalendarEventTime(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Location</label>
              <input value={calendarEventLocation} onChange={(e) => setCalendarEventLocation(e.target.value)} style={{ width: '100%' }} />
            </div>
            {showPracticeOptionInputs && (
              <>
                <div>
                  <label>Option A</label>
                  <input value={calendarEventOptionAText} onChange={(e) => setCalendarEventOptionAText(e.target.value)} placeholder="Optional member choice label" style={practiceOptionInputStyle} />
                </div>
                <div>
                  <label>Option B</label>
                  <input value={calendarEventOptionBText} onChange={(e) => setCalendarEventOptionBText(e.target.value)} placeholder="Optional member choice label" style={practiceOptionInputStyle} />
                </div>
                {hasPartialPracticeOptions && (
                  <div style={{ color: '#dc2626', fontSize: '0.875rem', fontWeight: '500', marginTop: '0.5rem' }}>
                    Add both options together, or clear both and save.
                  </div>
                )}
              </>
            )}
            {calendarEventEventType === 'match' && (
              <>
                <div>
                  <label>Description</label>
                  <textarea value={calendarEventDescription} onChange={(e) => setCalendarEventDescription(e.target.value)} rows={5} style={{ width: '100%' }} />
                </div>
                <div>
                  <label>Match Image</label>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <input value={calendarEventImageUrl} onChange={(e) => setCalendarEventImageUrl(e.target.value)} placeholder="Image URL" style={{ width: '100%' }} />
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ width: '100%' }} />
                    {uploading && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Uploading image...</div>}
                    {calendarEventImageUrl && <img src={calendarEventImageUrl} alt="Match" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, objectFit: 'cover' }} />}
                  </div>
                </div>
                <div>
                  <label>YouTube URL</label>
                  <input value={calendarEventYoutubeUrl} onChange={(e) => setCalendarEventYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." style={{ width: '100%' }} />
                </div>
              </>
            )}
            <div>
              <label>Maximum Capacity</label>
              <input type="number" min="1" value={calendarEventMaximumCapacity} onChange={(e) => setCalendarEventMaximumCapacity(e.target.value)} style={{ width: '100%' }} />
            </div>
            <hr style={{ margin: '1rem 0' }} />
            <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="costType"
                      value="Total"
                      checked={calendarEventCostType === 'Total'}
                      onChange={(e) => setCalendarEventCostType(e.target.value)}
                    />
                    Total Event Cost
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="costType"
                      value="Individual"
                      checked={calendarEventCostType === 'Individual'}
                      onChange={(e) => setCalendarEventCostType(e.target.value)}
                    />
                    Per Person Cost
                  </label>
                </div>
            </div>
            <div>
                <label>Cost</label>
                <input type="number" min="0" step="0.01" value={calendarEventSessionCost} onChange={(e) => setCalendarEventSessionCost(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
                <label>Paid By</label>
                <select value={calendarEventPaidBy} onChange={(e) => setCalendarEventPaidBy(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Not specified</option>
                  {users.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.full_name || u.email}
                    </option>
                  ))}
                </select>
            </div>
            <hr/>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nav-btn" type="submit" disabled={isSubmittingCalendarEvent} style={{ background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: '600', opacity: isSubmittingCalendarEvent ? 0.7 : 1, cursor: isSubmittingCalendarEvent ? 'not-allowed' : 'pointer' }}>{isSubmittingCalendarEvent ? (editingCalendarEventId ? 'Updating Event...' : 'Adding Event...') : (editingCalendarEventId ? 'Update Event' : 'Add Event')}</button>
              {(editingCalendarEventId || calendarEventDate || calendarEventTime !== '21:00' || calendarEventLocation || calendarEventEventType !== 'practice' || calendarEventTitle !== 'Session' || calendarEventDescription || calendarEventImageUrl || calendarEventYoutubeUrl || calendarEventOptionAText || calendarEventOptionBText || calendarEventSessionCost || calendarEventCostType !== 'Total' || calendarEventPaidBy || calendarEventMaximumCapacity !== '18') && (
                <button className="nav-btn" type="button" onClick={resetCalendarEventForm} disabled={isSubmittingCalendarEvent} style={{ background: '#6b7280', color: 'white', border: '1px solid #6b7280', fontWeight: '600', opacity: isSubmittingCalendarEvent ? 0.7 : 1, cursor: isSubmittingCalendarEvent ? 'not-allowed' : 'pointer' }}>
                  Clear
                </button>
              )}
            </div>
            {calendarEventInlineStatus && (
              <div style={{ color: calendarEventInlineStatus.includes('both event options') || calendarEventInlineStatus.includes('saved together') ? '#dc2626' : (isSubmittingCalendarEvent ? '#6b7280' : '#16a34a'), fontSize: '0.875rem', fontWeight: '500' }}>
                {calendarEventInlineStatus}
              </div>
            )}
          </form>

          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button
                className={`admin-menu-tab ${practiceListTab === 'upcoming' ? 'active' : ''}`}
                type="button"
                onClick={() => setPracticeListTab('upcoming')}
                style={{
                  minWidth: '110px',
                  flex: '1 1 120px',
                  textAlign: 'center'
                }}
              >
                Upcomig
              </button>
              <button
                className={`admin-menu-tab ${practiceListTab === 'past' ? 'active' : ''}`}
                type="button"
                onClick={() => setPracticeListTab('past')}
                style={{
                  minWidth: '110px',
                  flex: '1 1 120px',
                  textAlign: 'center'
                }}
              >
                Past
              </button>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {(practiceListTab === 'upcoming' ? upcomingCalendarEvents : pastCalendarEvents).map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    const params = new URLSearchParams()
                    params.set('date', s.date)
                    if (s.id != null) {
                      params.set('sessionId', String(s.id))
                    }
                    navigate(`/calendar?${params.toString()}`)
                  }}
                  style={{ border: '1px solid #d1d5db', padding: '1rem', borderRadius: 8, background: '#fafafa', cursor: 'pointer' }}
                >
                  {(() => {
                    const actionsLocked = s.payment_requested
                    return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{formatEventTypeLabel(s.event_type)}</strong>
                      <div style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: 2 }}>{s.event_title || formatEventTypeLabel(s.event_type)}</div>
                    </div>
                    <div className="admin-mobile-action-group">
                      <button className="nav-btn admin-mobile-action-btn" onClick={(e) => { e.stopPropagation(); handleEditCalendarEvent(s) }} disabled={actionsLocked} aria-label="Edit event" title="Edit event" style={{ border: '1px solid #d1d5db', color: actionsLocked ? '#9ca3af' : '#111827', cursor: actionsLocked ? 'not-allowed' : 'pointer', background: actionsLocked ? '#f3f4f6' : 'var(--theme-surface-alt)' }}>
                        <span className="admin-mobile-action-text">Edit</span>
                        <span className="admin-mobile-action-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </span>
                      </button>
                      <button
                        className="nav-btn admin-mobile-action-btn"
                        onClick={(e) => { e.stopPropagation(); handleDeleteCalendarEvent(s.id) }}
                        disabled={actionsLocked}
                        aria-label="Delete event"
                        title="Delete event"
                        style={{
                          background: actionsLocked ? '#d1d5db' : 'var(--theme-danger-soft)',
                          color: actionsLocked ? '#6b7280' : 'var(--theme-danger-strong)',
                          border: actionsLocked ? '1px solid #d1d5db' : '1px solid color-mix(in srgb, var(--theme-danger) 30%, white)',
                          cursor: actionsLocked ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <span className="admin-mobile-action-text">Delete</span>
                        <span className="admin-mobile-action-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  </div>
                    )
                  })()}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.8, marginTop: 6 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    <span>{s.date} {s.time || ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>{s.location || 'TBC'}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid color-mix(in srgb, var(--theme-text) 15%, transparent)' }} />
                  <div style={{ opacity: 0.8 }}>Max Capacity: {s.maximum_capacity || 100}</div>
                  <div style={{ opacity: 0.8 }}>{s.cost_type} Cost: {s.session_cost != null ? `£${Number(s.session_cost).toFixed(2)}` : 'Not set'}</div>
                  <div style={{ opacity: 0.8 }}>Paid By: {s.paid_by_name || s.paid_by || 'Not set'}</div>
                  {(s.option_a_text && s.option_b_text) && (
                    <div style={{ opacity: 0.8 }}>Options: {s.option_a_text} / {s.option_b_text}</div>
                  )}
                  {s.event_type === 'match' && s.youtube_url && (
                    <div style={{ opacity: 0.8, wordBreak: 'break-word' }}>YouTube: {s.youtube_url}</div>
                  )}
                  {s.event_type === 'match' && s.image_url && (
                    <img src={s.image_url} alt={s.event_title || 'Match'} style={{ marginTop: '0.5rem', maxWidth: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'cover' }} />
                  )}
                  {s.payment_requested && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Payment requested hence changes not allowed.
                    </div>
                  )}
                </div>
              ))}
              {(practiceListTab === 'upcoming' ? upcomingCalendarEvents : pastCalendarEvents).length === 0 && (
                <p>{practiceListTab === 'upcoming' ? 'No upcoming events.' : 'No past events.'}</p>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <>
          <div style={{ marginTop: '1rem' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                border: '1px solid #d1d5db',
                borderRadius: '0.75rem',
                padding: '1rem',
                background: 'white',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.35rem' }}>Registered Users</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#111827' }}>{users.length}</div>
              </div>
              <div style={{
                border: '1px solid #d1d5db',
                borderRadius: '0.75rem',
                padding: '1rem',
                background: 'white',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.35rem' }}>Upcoming Birthdays</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#111827' }}>{upcomingBirthdaysCount}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.35rem' }}>Next 30 days</div>
              </div>
            </div>
            <input
              type="text"
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              placeholder="Search users by name"
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.75rem',
                fontSize: '0.95rem',
                marginBottom: '1rem',
                boxSizing: 'border-box'
              }}
            />
            {filteredUsers.map((u) => {
              const isUpcomingBirthdayUser = hasUpcomingBirthday(u.birthday)
              return (
              <div
                key={u.email}
                style={{
                  border: isUpcomingBirthdayUser ? '1px solid #f59e0b' : u.email === user?.email ? '1px solid #86efac' : u.user_type === 'admin' ? '1px solid #fdba74' : '1px solid #d1d5db',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: isUpcomingBirthdayUser ? 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)' : u.email === user?.email ? '#f0fdf4' : u.user_type === 'admin' ? '#fff7ed' : 'white',
                  boxShadow: isUpcomingBirthdayUser ? '0 4px 14px rgba(245, 158, 11, 0.15)' : u.user_type === 'admin' ? '0 2px 8px rgba(245, 158, 11, 0.08)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ flex: '1', minWidth: 0, paddingRight: '0.5rem' }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                    {editingUserId === u.email ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={editingUserName}
                          onChange={(e) => setEditingUserName(e.target.value)}
                          style={{
                            padding: '0.5rem',
                            border: '2px solid #3b82f6',
                            borderRadius: '0.375rem',
                            fontSize: '1rem',
                            flex: '1',
                            outline: 'none'
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveUserName(u.email)}
                          style={{
                            padding: '0.5rem',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '1.25rem',
                            lineHeight: '1',
                            width: '2rem',
                            height: '2rem'
                          }}
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setEditingUserId(null)
                            setEditingUserName('')
                          }}
                          style={{
                            padding: '0.5rem',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '1.25rem',
                            lineHeight: '1',
                            width: '2rem',
                            height: '2rem'
                          }}
                          title="Cancel"
                        >
                          ✗
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontWeight: '700', fontSize: '1.2rem', lineHeight: '1.25' }}>
                        {u.full_name}
                      </div>
                    )}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.95rem', wordBreak: 'break-word', marginBottom: '0.75rem' }}>
                      {u.email}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                      Birthday {formatBirthday(u.birthday)}
                    </div>
                    {isUpcomingBirthdayUser && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        marginBottom: '0.75rem',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '999px',
                        background: '#ffffff',
                        border: '1px solid #fdba74',
                        color: '#9a3412',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}>
                        🎉 Upcoming birthday
                      </div>
                    )}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        
                        <span style={{ fontSize: '0.95rem', fontWeight: u.user_type === 'member' ? 'bold' : 'normal', color: '#6b7280', minWidth: '4.5rem' }}>Member </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateUserType(u.email, u.user_type === 'admin' ? 'member' : 'admin')}
                          disabled={u.email === user?.email}
                          style={{
                            position: 'relative',
                            width: '4rem',
                            height: '1.5rem',
                            backgroundColor: u.user_type === 'admin' ? '#f97316' : '#3b82f6',
                            border: 'none',
                            borderRadius: '0.75rem',
                            cursor: u.email === user?.email ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                            padding: 0
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: '0.125rem',
                              left: u.user_type === 'admin' ? '2.625rem' : '0.125rem',
                              width: '1.25rem',
                              height: '1.25rem',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              transition: 'transform 0.2s',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                        </button>
                        <span style={{ fontSize: '0.95rem', fontWeight: u.user_type === 'admin' ? 'bold' : 'normal', color: '#6b7280', minWidth: '5rem' }}>Admin</span>
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        
                        <span style={{ fontSize: '0.95rem', fontWeight: u.payment_mode === 'Daily' ? 'bold' : 'normal', color: '#6b7280', minWidth: '4.5rem' }}>Pay Daily</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateUserPaymentMode(u.email, u.payment_mode === 'Monthly' ? 'Daily' : 'Monthly')}
                          disabled={u.email === user?.email}
                          style={{
                            position: 'relative',
                            width: '4rem',
                            height: '1.5rem',
                            backgroundColor: u.payment_mode === 'Monthly' ? '#10b981' : '#06b6d4',
                            border: 'none',
                            borderRadius: '0.75rem',
                            cursor: u.email === user?.email ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                            padding: 0
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: '0.125rem',
                              left: u.payment_mode === 'Monthly' ? '2.625rem' : '0.125rem',
                              width: '1.25rem',
                              height: '1.25rem',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              transition: 'transform 0.2s',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                        </button>
                        <span style={{ fontSize: '0.95rem', fontWeight: u.payment_mode === 'Monthly' ? 'bold' : 'normal', color: '#6b7280', minWidth: '5rem' }}>Pay Monthly</span>
                      </div>
                    </div>
                    {userTypeStatusByEmail[u.email] && (
                      <div style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.75rem' }}>
                        {userTypeStatusByEmail[u.email]}
                      </div>
                    )}
                    {paymentModeStatusByEmail[u.email] && (
                      <div style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.75rem' }}>
                        {paymentModeStatusByEmail[u.email]}
                      </div>
                    )}
                  </div>
                  {editingUserId !== u.email && (
                    <div className="admin-mobile-action-group" style={{ flexWrap: 'nowrap', flexShrink: 0 }}>
                      <button 
                        className="nav-btn admin-mobile-action-btn" 
                        disabled={u.user_type === 'admin' && u.email !== user?.email}
                        onClick={() => {
                          if (u.email === user?.email) {
                            navigate('/user/profile')
                            return
                          }
                          if (u.user_type === 'admin') {
                            return
                          }
                          setEditingUserId(u.email)
                          setEditingUserName(u.full_name)
                        }}
                        aria-label={u.email === user?.email ? 'Edit profile' : 'Edit user'}
                        title={u.email === user?.email ? 'Edit profile' : 'Edit user'}
                        style={{ 
                          fontSize: '0.875rem',
                          border: u.email === user?.email ? '1px solid #16a34a' : '1px solid #d1d5db',
                          color: u.email === user?.email ? '#16a34a' : u.user_type === 'admin' ? '#9ca3af' : '#111827',
                          background: u.user_type === 'admin' && u.email !== user?.email ? '#f3f4f6' : 'var(--theme-surface-alt)',
                          cursor: u.user_type === 'admin' && u.email !== user?.email ? 'not-allowed' : 'pointer',
                          opacity: u.user_type === 'admin' && u.email !== user?.email ? 0.7 : 1
                        }}
                      >
                        <span className="admin-mobile-action-text">Edit</span>
                        <span className="admin-mobile-action-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </span>
                      </button>
                      <button 
                        className="nav-btn admin-mobile-action-btn" 
                        onClick={() => handleDeleteUser(u.email)}
                        disabled={u.email === user?.email || u.user_type === 'admin'}
                        aria-label="Delete user"
                        title="Delete user"
                        style={{ 
                          background: u.email === user?.email || u.user_type === 'admin' ? '#f3f4f6' : 'var(--theme-danger-soft)', 
                          color: u.email === user?.email || u.user_type === 'admin' ? '#9ca3af' : 'var(--theme-danger-strong)', 
                          border: u.email === user?.email || u.user_type === 'admin' ? '1px solid #d1d5db' : '1px solid color-mix(in srgb, var(--theme-danger) 30%, white)',
                          fontSize: '0.875rem',
                          cursor: u.email === user?.email || u.user_type === 'admin' ? 'not-allowed' : 'pointer',
                          opacity: 1
                        }}
                      >
                        <span className="admin-mobile-action-text">Delete</span>
                        <span className="admin-mobile-action-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    <div>
                      <strong>Registered:</strong> {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                    </div>
                    <div>
                      <strong>Last Login:</strong> {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>
              </div>
              )
            })}
            {filteredUsers.length === 0 && <p style={{ marginTop: '1rem', textAlign: 'center', color: '#6b7280' }}>No users found.</p>}
          </div>
        </>
      )}

      {activeTab === 'expense' && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ border: '1px solid #d1d5db', borderRadius: '0.75rem', padding: '1rem', background: 'white', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)' }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.35rem' }}>Filtered Total</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#111827' }}>£{filteredExpenseTotal.toFixed(2)}</div>
            </div>
            <div style={{ border: '1px solid #d1d5db', borderRadius: '0.75rem', padding: '1rem', background: 'white', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)' }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.35rem' }}>Matching Expenses</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#111827' }}>{filteredExpenses.length}</div>
            </div>
          </div>

          <form onSubmit={handleSubmitExpense} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            maxWidth: 700,
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div>
              <label>Expense Title</label>
              <input value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label>Amount</label>
                <input type="number" min="0" step="0.01" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label>Paid By</label>
                <select value={expensePaidBy} onChange={(e) => setExpensePaidBy(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select User</option>
                  {users.map((u) => (
                    <option key={u.email} value={u.email}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Category</label>
                <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select category (optional)</option>
                  {expenseCategoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label>Payment Method</label>
              <input value={expensePaymentMethod} onChange={(e) => setExpensePaymentMethod(e.target.value)} placeholder="e.g. Bank transfer, Cash, Card" style={{ width: '100%' }} />
            </div>
            <div>
              <label>Description</label>
              <textarea rows={4} value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="Optional notes, vendor, invoice reference, or reason for expense" style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nav-btn" type="submit" style={{ background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: '600' }}>
                {editingExpenseId ? 'Update Expense' : 'Add Expense'}
              </button>
              {(editingExpenseId || expenseTitle || expenseAmount || expensePaidBy || expenseDate || expenseCategory || expensePaymentMethod || expenseDescription) && (
                <button className="nav-btn" type="button" onClick={resetExpenseForm} style={{ background: '#6b7280', color: 'white', border: '1px solid #6b7280', fontWeight: '600' }}>
                  Clear
                </button>
              )}
            </div>
          </form>

          <h3 style={{ marginTop: '2rem' }}>Expenses</h3>
          <div style={{
            border: '1px solid #d1d5db',
            borderRadius: '0.75rem',
            padding: '1rem',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
            marginBottom: '1rem'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <label>Search</label>
                <input
                  value={expenseSearchTerm}
                  onChange={(e) => setExpenseSearchTerm(e.target.value)}
                  placeholder="Search title, description, category, payer..."
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label>Filter by Category</label>
                <select value={expenseCategoryFilter} onChange={(e) => setExpenseCategoryFilter(e.target.value)} style={{ width: '100%' }}>
                  <option value="all">All categories</option>
                  {availableExpenseCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Filter by Paid By</label>
                <select value={expensePaidByFilter} onChange={(e) => setExpensePaidByFilter(e.target.value)} style={{ width: '100%' }}>
                  <option value="all">All users</option>
                  {users.map((u) => (
                    <option key={u.email} value={u.email}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  type="button"
                  className="nav-btn"
                  onClick={() => {
                    setExpenseSearchTerm('')
                    setExpenseCategoryFilter('all')
                    setExpensePaidByFilter('all')
                  }}
                  style={{ border: '1px solid #d1d5db', color: '#111827', width: '100%' }}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredExpenses.map((expense) => (
              <div key={expense.id} style={{ border: '1px solid #d1d5db', padding: '1rem', borderRadius: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{expense.expense_date}</strong>
                  </div>
                  <div className="admin-mobile-action-group">
                    <button className="nav-btn admin-mobile-action-btn" disabled={expense.can_edit === false} onClick={() => handleEditExpense(expense)} aria-label="Edit expense" title="Edit expense" style={{ border: '1px solid #d1d5db', color: expense.can_edit === false ? '#9ca3af' : '#111827', background: expense.can_edit === false ? '#f3f4f6' : 'var(--theme-surface-alt)', opacity: expense.can_edit === false ? 0.6 : 1, cursor: expense.can_edit === false ? 'not-allowed' : 'pointer' }}>
                      <span className="admin-mobile-action-text">Edit</span>
                      <span className="admin-mobile-action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </span>
                    </button>
                    <button className="nav-btn admin-mobile-action-btn" disabled={expense.can_delete === false} onClick={() => handleDeleteExpense(expense.id)} aria-label="Delete expense" title="Delete expense" style={{ background: expense.can_delete === false ? '#f3f4f6' : 'var(--theme-danger-soft)', color: expense.can_delete === false ? '#9ca3af' : 'var(--theme-danger-strong)', border: expense.can_delete === false ? '1px solid #d1d5db' : '1px solid color-mix(in srgb, var(--theme-danger) 30%, white)', opacity: expense.can_delete === false ? 0.6 : 1, cursor: expense.can_delete === false ? 'not-allowed' : 'pointer' }}>
                      <span className="admin-mobile-action-text">Delete</span>
                      <span className="admin-mobile-action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </span>
                    </button>
                  </div>
                </div>
                <div style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '0.4rem' }}>{expense.title}</div>
                <div style={{ opacity: 0.85, marginBottom: '0.35rem', fontSize: '0.95rem' }}>Amount: £{Number(expense.amount || 0).toFixed(2)}</div>
                <div style={{ opacity: 0.8, marginBottom: '0.35rem', fontSize: '0.9rem' }}>Paid By: {expense.paid_by_name || expense.paid_by || 'Not specified'}</div>
                {((!expense.is_booking_expense && expense.category) || expense.payment_method) && (
                  <div style={{ opacity: 0.8, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                    {[!expense.is_booking_expense ? expense.category : null, expense.payment_method].filter(Boolean).join(' · ')}
                  </div>
                )}
                {expense.description && <div style={{ opacity: 0.85, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{expense.description}</div>}
              </div>
            ))}
            {filteredExpenses.length === 0 && <p>{sortedExpenses.length === 0 ? 'No expenses recorded yet.' : 'No expenses match the current filters.'}</p>}
          </div>
        </>
      )}

      {activeTab === 'reports' && (
        <Reports />
      )}

      {activeTab === 'notifications' && isSuperAdmin && (
        <>
          <h3>Notifications</h3>
          <p style={{ color: '#6b7280', maxWidth: '900px' }}>
            Configure notification delivery across app, email, and WhatsApp. You can control per-type channel enablement,
            recipient targeting, and the message template used in each platform.
          </p>

          <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
            {notificationSettings.map((setting) => (
              <div
                key={setting.notif_type}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  background: 'white',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                }}
              >
                <div className="admin-card-header">
                  <div className="admin-card-header-main">
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '0.25rem' }}>{setting.display_name}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{setting.description || 'No description set.'}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.35rem' }}>Type: {setting.notif_type}</div>
                  </div>
                  <div className="admin-mobile-action-group">
                    <button
                      className="nav-btn admin-mobile-action-btn"
                      onClick={() => handleSaveNotificationSetting(setting.notif_type)}
                      disabled={notificationSaving === setting.notif_type}
                      aria-label="Save notification setting"
                      title="Save notification setting"
                      style={{ background: '#10b981', color: 'white', border: '1px solid #10b981' }}
                    >
                      <span className="admin-mobile-action-text">{notificationSaving === setting.notif_type ? 'Saving...' : 'Save'}</span>
                      <span className="admin-mobile-action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <path d="M17 21v-8H7v8" />
                          <path d="M7 3v5h8" />
                        </svg>
                      </span>
                    </button>
                    <button
                      className="nav-btn admin-mobile-action-btn"
                      onClick={() => handleResetNotificationSetting(setting.notif_type)}
                      disabled={notificationSaving === setting.notif_type}
                      aria-label="Reset notification setting"
                      title="Reset notification setting"
                      style={{ border: '1px solid #d1d5db', color: '#111827' }}
                    >
                      <span className="admin-mobile-action-text">Reset</span>
                      <span className="admin-mobile-action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 3-6.7" />
                          <path d="M3 3v6h6" />
                        </svg>
                      </span>
                    </button>
                  </div>
                </div>
                {notificationSaveStatusByType[setting.notif_type] && (
                  <div style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: '500', marginBottom: '1rem' }}>
                    {notificationSaveStatusByType[setting.notif_type]}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label>Display Name</label>
                    <input
                      value={setting.display_name}
                      onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'display_name', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label>Target Users</label>
                    <select
                      value={setting.target_audience}
                      onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'target_audience', e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {notificationMeta.target_audiences.map((audience) => (
                        <option key={audience.value} value={audience.value}>
                          {audience.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label>Description</label>
                  <textarea
                    rows={2}
                    value={setting.description || ''}
                    onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'description', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={setting.app_enabled}
                      onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'app_enabled', e.target.checked)}
                    />
                    App enabled
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={setting.email_enabled}
                      onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'email_enabled', e.target.checked)}
                    />
                    Email enabled
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={setting.whatsapp_enabled}
                      onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'whatsapp_enabled', e.target.checked)}
                    />
                    WhatsApp enabled
                  </label>
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label>App Template</label>
                    <textarea
                      rows={3}
                      value={setting.app_template}
                      onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'app_template', e.target.value)}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>
                      Available variables: {getNotificationVariables(setting.notif_type).join(', ') || 'No variables available'}
                    </div>
                    <div style={{ marginTop: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', background: '#f9fafb', padding: '0.75rem' }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.35rem', fontSize: '0.9rem' }}>App preview</div>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#111827', fontSize: '0.9rem' }}>
                        {renderNotificationPreview(setting.app_template, setting.notif_type) || 'No app message preview available.'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label>Email Subject</label>
                    <input
                      value={setting.email_subject}
                      onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'email_subject', e.target.value)}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>
                      Available variables: {getNotificationVariables(setting.notif_type).join(', ') || 'No variables available'}
                    </div>
                    <div style={{ marginTop: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', background: '#f9fafb', padding: '0.75rem' }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.35rem', fontSize: '0.9rem' }}>Email subject preview</div>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#111827', fontSize: '0.9rem' }}>
                        {renderNotificationPreview(setting.email_subject, setting.notif_type) || 'No email subject preview available.'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label>Email Template</label>
                    <textarea
                      rows={4}
                      value={setting.email_template}
                      onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'email_template', e.target.value)}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>
                      Available variables: {getNotificationVariables(setting.notif_type).join(', ') || 'No variables available'}
                    </div>
                    <div style={{ marginTop: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', background: '#f9fafb', padding: '0.75rem' }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.35rem', fontSize: '0.9rem' }}>Email body preview</div>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#111827', fontSize: '0.9rem' }}>
                        {renderNotificationPreview(setting.email_template, setting.notif_type) || 'No email body preview available.'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label>WhatsApp Template</label>
                    <textarea
                      rows={4}
                      value={setting.whatsapp_template}
                      onChange={(e) => handleNotificationFieldChange(setting.notif_type, 'whatsapp_template', e.target.value)}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>
                      Available variables: {getNotificationVariables(setting.notif_type).join(', ') || 'No variables available'}
                    </div>
                    <div style={{ marginTop: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', background: '#f9fafb', padding: '0.75rem' }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.35rem', fontSize: '0.9rem' }}>WhatsApp preview</div>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#111827', fontSize: '0.9rem' }}>
                        {renderNotificationPreview(setting.whatsapp_template, setting.notif_type) || 'No WhatsApp preview available.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {notificationSettings.length === 0 && (
              <p style={{ marginTop: '1rem', textAlign: 'center', color: '#6b7280' }}>
                No notification settings found.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
