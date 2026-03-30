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
    { value: 'event', label: 'Add Match' },
    { value: 'forum', label: 'Forum Posts' },
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

  // Practice sessions
  const [practiceSessions, setPracticeSessions] = useState([])
  const [editingPracticeDate, setEditingPracticeDate] = useState(null)
  const [practiceDate, setPracticeDate] = useState('')
  const [practiceTime, setPracticeTime] = useState('21:00')
  const [practiceLocation, setPracticeLocation] = useState('')
  const [practiceEventType, setPracticeEventType] = useState('practice')
  const [practiceEventTitle, setPracticeEventTitle] = useState('Session')
  const [practiceSessionCost, setPracticeSessionCost] = useState('')
  const [practicePaidBy, setPracticePaidBy] = useState('')
  const [practiceMaximumCapacity, setPracticeMaximumCapacity] = useState('18')
  const [practiceInlineStatus, setPracticeInlineStatus] = useState('')
  const [practiceListTab, setPracticeListTab] = useState('upcoming')

  // Forum posts
  const [forumPosts, setForumPosts] = useState([])
  const [editingForumPostId, setEditingForumPostId] = useState(null)
  const [forumPostContent, setForumPostContent] = useState('')

  // Users
  const [users, setUsers] = useState([])
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingUserName, setEditingUserName] = useState('')
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userTypeStatusByEmail, setUserTypeStatusByEmail] = useState({})

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
      date: '2026-03-20',
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
    match: {
      date: '2026-03-28',
      time: '2:00 PM',
      location: 'Toryglen Regional Football Centre',
      event_name: 'GBFC vs Rivals FC',
      author_name: '',
      content: '',
      content_preview: '',
      time_suffix: ' at 2:00 PM',
      location_suffix: ' at Toryglen Regional Football Centre',
      location_comma_suffix: ', Toryglen Regional Football Centre',
      time_line: '🕐 2:00 PM\n',
      location_line: '📍 Toryglen Regional Football Centre\n',
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
      date: '2026-04-02',
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
      date: '2026-04-02',
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
      date: '2026-04-02',
      time: '8:00 PM',
      location: 'Scotstoun Sports Campus',
      event_name: 'Practice - Session',
      event_type: 'practice',
      event_type_label: 'Practice',
      event_title: 'Session',
      payments_link: 'https://glasgow-bengali-fc.vercel.app/user-actions/payments',
      time_suffix: ' at 8:00 PM',
      location_suffix: ' at Scotstoun Sports Campus',
      location_comma_suffix: ', Scotstoun Sports Campus',
      time_line: '🕐 8:00 PM\n',
      location_line: '📍 Scotstoun Sports Campus\n',
    },
    session_capacity_reached: {
      date: '2026-04-10',
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
      date: '2026-04-12',
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
    practice: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    match: ['{{event_name}}', '{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    forum_post: ['{{author_name}}', '{{content}}', '{{content_preview}}'],
    payment_request: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    payment_confirmed: ['{{member_name}}', '{{full_name}}', '{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    pending_payment_reminder: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{payments_link}}', '{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    session_capacity_reached: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{time}}', '{{location}}', '{{maximum_capacity}}', '{{available_count}}', '{{remaining_slots}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    practice_slot_available: ['{{event_name}}', '{{event_type}}', '{{event_type_label}}', '{{event_title}}', '{{date}}', '{{time}}', '{{location}}', '{{maximum_capacity}}', '{{available_count}}', '{{remaining_slots}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
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
    const res = await fetch(apiUrl('/api/events'))
    if (res.ok) setEvents(await res.json())
  }

  const loadPracticeSessions = async () => {
    const res = await fetch(apiUrl('/api/practice/sessions'))
    if (res.ok) setPracticeSessions(await res.json())
  }

  const loadForumPosts = async () => {
    const res = await fetch(apiUrl('/api/forum'))
    if (res.ok) setForumPosts(await res.json())
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
    if (tabName === 'event') loadEvents()
    else if (tabName === 'events') {
      loadPracticeSessions()
      loadUsers()
    }
    else if (tabName === 'forum') loadForumPosts()
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
      
      if (activeTab === 'event') {
        loadEvents()
        newLoadedTabs.add('event')
        didLoadTab = true
      } else if (activeTab === 'events') {
        loadPracticeSessions()
        loadUsers()
        newLoadedTabs.add('events')
        didLoadTab = true
      } else if (activeTab === 'forum') {
        loadForumPosts()
        newLoadedTabs.add('forum')
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
    setEventLocation('')
    setEventDescription('')
    setEventImageUrl('')
    setEventYoutubeUrl('')
  }

  const resetPracticeForm = () => {
    setEditingPracticeDate(null)
    setPracticeDate('')
    setPracticeTime('21:00')
    setPracticeLocation('')
    setPracticeEventType('practice')
    setPracticeEventTitle('Session')
    setPracticeSessionCost('')
    setPracticePaidBy('')
    setPracticeMaximumCapacity('18')
    setPracticeInlineStatus('')
  }

  const resetForumPostForm = () => {
    setEditingForumPostId(null)
    setForumPostContent('')
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
      setEventImageUrl(data.image_url)
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
    const res = await fetch(apiUrl(editingEventId ? `/api/events/${editingEventId}` : '/api/events'), {
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
    const res = await fetch(apiUrl(`/api/events/${id}`), {
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

  const handleSubmitPractice = async (e) => {
    e.preventDefault()
    const isEditingPractice = Boolean(editingPracticeDate)
    setPracticeInlineStatus('')

    const payload = {
      date: practiceDate,
      time: practiceTime,
      location: practiceLocation,
      event_type: practiceEventType,
      event_title: practiceEventTitle,
      session_cost: practiceSessionCost !== '' ? parseFloat(practiceSessionCost) : null,
      paid_by: practicePaidBy || null,
      maximum_capacity: practiceMaximumCapacity ? parseInt(practiceMaximumCapacity, 10) : 100,
    }

    let res
    // If admin changes the date while editing, treat it as delete old + create new
    if (editingPracticeDate && editingPracticeDate !== practiceDate) {
      const del = await fetch(apiUrl(`/api/practice/${editingPracticeDate}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!del.ok) {
        const delData = await del.json().catch(() => ({}))
        setMessage(delData?.detail || 'Failed to update event (delete old)')
        return
      }
      res = await fetch(apiUrl('/api/practice/sessions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
    } else if (editingPracticeDate) {
      res = await fetch(apiUrl(`/api/practice/sessions/${editingPracticeDate}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch(apiUrl('/api/practice/sessions'), {
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
      return
    }
    setMessage(isEditingPractice ? 'Event updated.' : 'Event created.')
    resetPracticeForm()
    setPracticeInlineStatus(isEditingPractice ? 'Record updated successfully!' : 'New event added!')
    refreshTabData('events')
  }

  const handleEditPractice = (s) => {
    if (s.payment_requested) return
    setActiveTab('events')
    setPracticeInlineStatus('')
    setEditingPracticeDate(s.date)
    setPracticeDate(s.date || '')
    setPracticeTime(s.time || '')
    setPracticeLocation(s.location || '')
    setPracticeEventType(s.event_type || 'practice')
    setPracticeEventTitle(s.event_title || '')
    setPracticeSessionCost(s.session_cost != null ? String(s.session_cost) : '')
    setPracticePaidBy(s.paid_by || '')
    setPracticeMaximumCapacity((s.maximum_capacity || 100).toString())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeletePractice = async (dateStr) => {
    if (!confirm('Delete this event?')) return
    const res = await fetch(apiUrl(`/api/practice/${dateStr}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to delete event')
      return
    }
    setMessage('Event deleted.')
    refreshTabData('events')
  }

  const handleEditForumPost = (p) => {
    setActiveTab('forum')
    setEditingForumPostId(p.id)
    setForumPostContent(p.content || '')
  }

  const handleSubmitForumPost = async (e) => {
    e.preventDefault()
    if (!editingForumPostId) return

    const res = await fetch(apiUrl(`/api/forum/${editingForumPostId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: forumPostContent }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to update post')
      return
    }
    setMessage('Post updated.')
    resetForumPostForm()
    refreshTabData('forum')
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

  const handleDeleteForumPost = async (postId) => {
    if (!confirm('Delete this post?')) return
    const res = await fetch(apiUrl(`/api/forum/${postId}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to delete post')
      return
    }
    setMessage('Post deleted.')
    if (editingForumPostId === postId) resetForumPostForm()
    refreshTabData('forum')
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
        ? 'Updated user to Admin'
        : 'Updated user to Member'
    }))
    setMessage(`User type updated to ${userType}.`)
    refreshTabData('users')
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
    refreshTabData('forum')
  }

  const filteredUsers = [...users]
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

  const upcomingPracticeSessions = practiceSessions
    .filter((s) => new Date(`${s.date}T00:00:00`) >= todayAtMidnight)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const pastPracticeSessions = practiceSessions
    .filter((s) => new Date(`${s.date}T00:00:00`) < todayAtMidnight)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

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
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'event' && (
        <>
          <form onSubmit={handleSubmitEvent} style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem', 
            maxWidth: 600,
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div>
              <label>Event Name</label>
              <input value={eventName} onChange={(e) => setEventName(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div>
              <label>Date</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div>
              <label>Time</label>
              <input value={eventTime} onChange={(e) => setEventTime(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Location</label>
              <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Image Upload</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
              {eventImageUrl && <div style={{ marginTop: 8 }}><img src={eventImageUrl} alt="" style={{ maxWidth: 200, borderRadius: 6 }} /></div>}
            </div>
            <div>
              <label>YouTube URL</label>
              <input value={eventYoutubeUrl} onChange={(e) => setEventYoutubeUrl(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Description</label>
              <textarea rows={6} value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nav-btn" type="submit" style={{ background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: '600' }}>{editingEventId ? 'Update Match' : 'Add Match'}</button>
              {editingEventId && (
                <button className="nav-btn" type="button" onClick={resetEventForm} style={{ background: '#6b7280', color: 'white', border: '1px solid #6b7280', fontWeight: '600' }}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <h3 style={{ marginTop: '2rem' }}>Matches</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {events.sort((a, b) => new Date(b.date) - new Date(a.date)).map((ev) => (
              <div key={ev.id} style={{ border: '1px solid #d1d5db', padding: '1rem', borderRadius: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{ev.date}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <button className="nav-btn" onClick={() => handleEditEvent(ev)} style={{ border: '1px solid #d1d5db', color: '#111827' }}>
                      Edit
                    </button>
                    <button className="nav-btn" onClick={() => handleDeleteEvent(ev.id)} style={{ background: '#ef4444', color: 'white', border: '1px solid #ef4444' }}>
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '0.4rem' }}>{ev.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.8, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  <span>{ev.date} {ev.time || 'TBD'}</span>
                </div>
                {ev.location && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>{ev.location}</span></div>}
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'events' && (
        <>
          <form onSubmit={handleSubmitPractice} style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem', 
            maxWidth: 560,
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div>
              <label>Event Type</label>
              <select value={practiceEventType} onChange={(e) => {
                const nextEventType = e.target.value
                setPracticeEventType(nextEventType)
                if (nextEventType !== 'practice') {
                  setPracticeEventTitle('')
                }
              }} style={{ width: '100%' }}>
                {eventTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Event Title</label>
              <input value={practiceEventTitle} onChange={(e) => setPracticeEventTitle(e.target.value.slice(0, 30))} maxLength={30} placeholder="Enter event title" style={{ width: '100%' }} />
            </div>
            <div>
              <label>Date</label>
              <input type="date" value={practiceDate} onChange={(e) => setPracticeDate(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div>
              <label>Time</label>
              <input type="time" value={practiceTime} onChange={(e) => setPracticeTime(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Location</label>
              <input value={practiceLocation} onChange={(e) => setPracticeLocation(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Maximum Capacity</label>
              <input type="number" min="1" value={practiceMaximumCapacity} onChange={(e) => setPracticeMaximumCapacity(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Total Cost</label>
              <input type="number" min="0" step="0.01" value={practiceSessionCost} onChange={(e) => setPracticeSessionCost(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Paid By</label>
              <select value={practicePaidBy} onChange={(e) => setPracticePaidBy(e.target.value)} style={{ width: '100%' }}>
                <option value="">Select user (optional)</option>
                {users.map((u) => (
                  <option key={u.email} value={u.email}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nav-btn" type="submit" style={{ background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: '600' }}>{editingPracticeDate ? 'Update Event' : 'Add Event'}</button>
              {(editingPracticeDate || practiceDate || practiceTime !== '21:00' || practiceLocation || practiceEventType !== 'practice' || practiceEventTitle !== 'Session' || practiceSessionCost || practicePaidBy || practiceMaximumCapacity !== '18') && (
                <button className="nav-btn" type="button" onClick={resetPracticeForm} style={{ background: '#6b7280', color: 'white', border: '1px solid #6b7280', fontWeight: '600' }}>
                  Clear
                </button>
              )}
            </div>
            {practiceInlineStatus && (
              <div style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: '500' }}>
                {practiceInlineStatus}
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
              {(practiceListTab === 'upcoming' ? upcomingPracticeSessions : pastPracticeSessions).map((s) => (
                <div
                  key={s.date}
                  onClick={() => navigate(`/calendar?date=${encodeURIComponent(s.date)}`)}
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
                    <div>
                      <button className="nav-btn" onClick={(e) => { e.stopPropagation(); handleEditPractice(s) }} disabled={actionsLocked} style={{ marginRight: 8, border: actionsLocked ? '1px solid #d1d5db' : '1px solid #d1d5db', color: actionsLocked ? '#9ca3af' : '#111827', cursor: actionsLocked ? 'not-allowed' : 'pointer', background: actionsLocked ? '#f3f4f6' : undefined }}>
                        Edit
                      </button>
                      <button
                        className="nav-btn"
                        onClick={(e) => { e.stopPropagation(); handleDeletePractice(s.date) }}
                        disabled={actionsLocked}
                        style={{
                          background: actionsLocked ? '#d1d5db' : '#ef4444',
                          color: 'white',
                          border: actionsLocked ? '1px solid #d1d5db' : '1px solid #ef4444',
                          cursor: actionsLocked ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Delete
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
                  <div style={{ opacity: 0.8 }}>Total Cost: {s.session_cost != null ? `£${Number(s.session_cost).toFixed(2)}` : 'Not set'}</div>
                  <div style={{ opacity: 0.8 }}>Paid By: {s.paid_by_name || s.paid_by || 'Not set'}</div>
                  {s.payment_requested && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Payment requested hence changes not allowed.
                    </div>
                  )}
                </div>
              ))}
              {(practiceListTab === 'upcoming' ? upcomingPracticeSessions : pastPracticeSessions).length === 0 && (
                <p>{practiceListTab === 'upcoming' ? 'No upcoming events.' : 'No past events.'}</p>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'forum' && (
        <>
          <h3>Forum Posts</h3>

          {editingForumPostId && (
            <form onSubmit={handleSubmitForumPost} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 900, marginTop: '1rem' }}>
              <div>
                <label>Edit Post Content</label>
                <textarea
                  rows={8}
                  value={forumPostContent}
                  onChange={(e) => setForumPostContent(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="nav-btn" type="submit" style={{ background: '#10b981', color: 'white', border: '1px solid #10b981' }}>Update Post</button>
                <button className="nav-btn" type="button" onClick={resetForumPostForm} style={{ background: 'white', color: '#111827', border: '1px solid #111827' }}>Cancel</button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
            {forumPosts.map((p) => (
              <div key={p.id} style={{ border: '1px solid #d1d5db', padding: '1rem', borderRadius: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <strong>{p.user_full_name}</strong>
                    <div style={{ opacity: 0.8, marginTop: 4 }}>{new Date(p.created_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <button className="nav-btn" onClick={() => handleEditForumPost(p)} style={{ marginRight: 8, border: '1px solid #d1d5db', color: '#111827' }}>
                      Edit
                    </button>
                    <button className="nav-btn" onClick={() => handleDeleteForumPost(p.id)} style={{ background: '#ef4444', color: 'white', border: '#ef4444' }}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10, opacity: 0.95 }}>
                  <div dangerouslySetInnerHTML={{ __html: p.content }} />
                </div>

                <div style={{ marginTop: 10, opacity: 0.8 }}>
                  Likes: {p.likes_count} · Comments: {p.comments.length}
                </div>
              </div>
            ))}
            {forumPosts.length === 0 && <p>No posts yet.</p>}
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
                  border: isUpcomingBirthdayUser ? '1px solid #f59e0b' : u.email === user?.email ? '1px solid #86efac' : '1px solid #d1d5db',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: isUpcomingBirthdayUser ? 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)' : u.email === user?.email ? '#f0fdf4' : 'white',
                  boxShadow: isUpcomingBirthdayUser ? '0 4px 14px rgba(245, 158, 11, 0.15)' : 'none'
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
                      <strong>Birthday:</strong> {formatBirthday(u.birthday)}
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
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem', color: '#374151' }}>
                        <input
                          type="radio"
                          name={`user-type-${u.email}`}
                          checked={u.user_type === 'member'}
                          disabled={u.email === user?.email}
                          onChange={() => handleUpdateUserType(u.email, 'member')}
                        />
                        Member
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem', color: '#374151' }}>
                        <input
                          type="radio"
                          name={`user-type-${u.email}`}
                          checked={u.user_type === 'admin'}
                          disabled={u.email === user?.email}
                          onChange={() => handleUpdateUserType(u.email, 'admin')}
                        />
                        Admin
                      </label>
                    </div>
                    {userTypeStatusByEmail[u.email] && (
                      <div style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.75rem' }}>
                        {userTypeStatusByEmail[u.email]}
                      </div>
                    )}
                  </div>
                  {editingUserId !== u.email && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'nowrap', flexShrink: 0 }}>
                      <button 
                        className="nav-btn" 
                        onClick={() => {
                          if (u.email === user?.email) {
                            navigate('/profile')
                            return
                          }
                          setEditingUserId(u.email)
                          setEditingUserName(u.full_name)
                        }}
                        style={{ 
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          border: u.email === user?.email ? '1px solid #16a34a' : '1px solid #d1d5db',
                          color: u.email === user?.email ? '#16a34a' : '#374151',
                          background: 'white'
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        className="nav-btn" 
                        onClick={() => handleDeleteUser(u.email)}
                        disabled={u.email === user?.email}
                        style={{ 
                          background: u.email === user?.email ? '#f3f4f6' : '#ef4444', 
                          color: u.email === user?.email ? '#9ca3af' : 'white', 
                          border: u.email === user?.email ? '1px solid #d1d5db' : '1px solid #ef4444',
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          cursor: u.email === user?.email ? 'not-allowed' : 'pointer',
                          opacity: u.email === user?.email ? 1 : 1
                        }}
                      >
                        Delete
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
                  <option value="">Select user (optional)</option>
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
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="nav-btn" disabled={expense.can_edit === false} onClick={() => handleEditExpense(expense)} style={{ border: '1px solid #d1d5db', color: expense.can_edit === false ? '#9ca3af' : '#111827', opacity: expense.can_edit === false ? 0.6 : 1, cursor: expense.can_edit === false ? 'not-allowed' : 'pointer' }}>
                      Edit
                    </button>
                    <button className="nav-btn" disabled={expense.can_delete === false} onClick={() => handleDeleteExpense(expense.id)} style={{ background: expense.can_delete === false ? '#f3f4f6' : '#ef4444', color: expense.can_delete === false ? '#9ca3af' : 'white', border: expense.can_delete === false ? '1px solid #d1d5db' : '1px solid #ef4444', opacity: expense.can_delete === false ? 0.6 : 1, cursor: expense.can_delete === false ? 'not-allowed' : 'pointer' }}>
                      Delete
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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '0.25rem' }}>{setting.display_name}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{setting.description || 'No description set.'}</div>
                    <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.35rem' }}>Type: {setting.notif_type}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <button
                      className="nav-btn"
                      onClick={() => handleSaveNotificationSetting(setting.notif_type)}
                      disabled={notificationSaving === setting.notif_type}
                      style={{ background: '#10b981', color: 'white', border: '1px solid #10b981' }}
                    >
                      {notificationSaving === setting.notif_type ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="nav-btn"
                      onClick={() => handleResetNotificationSetting(setting.notif_type)}
                      disabled={notificationSaving === setting.notif_type}
                      style={{ border: '1px solid #d1d5db', color: '#111827' }}
                    >
                      Reset
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
