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
    { value: 'practice', label: 'Add Practice' },
    { value: 'event', label: 'Add Match' },
    { value: 'forum', label: 'Forum Posts' },
    { value: 'users', label: 'Users' },
    { value: 'reports', label: 'Reports' },
    ...(isSuperAdmin ? [
      { value: 'notifications', label: 'Notifications' },
      { value: 'activity', label: 'User Activity' },
    ] : []),
  ]

  // Admin check: user_type is 'admin' OR email is 'super@admin.com'
  const isAdmin = user && (user.user_type === 'admin' || user.email === 'super@admin.com')

  const [message, setMessage] = useState('')
  
  // Route validation
  const validatedTab = validateAdminTab(routeTab)
  const activeTab = validatedTab || 'practice'
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

  // Notifications
  const [notificationSettings, setNotificationSettings] = useState([])
  const [notificationMeta, setNotificationMeta] = useState({ target_audiences: [], notification_types: [] })
  const [notificationSaving, setNotificationSaving] = useState('')
  const [notificationSaveStatusByType, setNotificationSaveStatusByType] = useState({})

  // User activity
  const [activityEvents, setActivityEvents] = useState([])
  const [activitySearchTerm, setActivitySearchTerm] = useState('')
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityStartDate, setActivityStartDate] = useState('')
  const [activityEndDate, setActivityEndDate] = useState('')
  const [activitySelectedUser, setActivitySelectedUser] = useState('')
  const [activitySelectedEventType, setActivitySelectedEventType] = useState('')
  const [activitySelectedSuccess, setActivitySelectedSuccess] = useState('')

  // Track which data has been loaded to prevent unnecessary reloads
  const [loadedTabs, setLoadedTabs] = useState(new Set())

  const notificationPreviewSamples = {
    practice: {
      date: '2026-03-20',
      time: '7:30 PM',
      location: 'Glasgow Green',
      event_name: '',
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
      event_name: '',
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
    practice: ['{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    match: ['{{event_name}}', '{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    forum_post: ['{{author_name}}', '{{content}}', '{{content_preview}}'],
    payment_request: ['{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    payment_confirmed: ['{{member_name}}', '{{full_name}}', '{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    pending_payment_reminder: ['{{payments_link}}', '{{date}}', '{{time}}', '{{location}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    session_capacity_reached: ['{{date}}', '{{time}}', '{{location}}', '{{maximum_capacity}}', '{{available_count}}', '{{remaining_slots}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    practice_slot_available: ['{{date}}', '{{time}}', '{{location}}', '{{maximum_capacity}}', '{{available_count}}', '{{remaining_slots}}', '{{time_suffix}}', '{{location_suffix}}', '{{location_comma_suffix}}', '{{time_line}}', '{{location_line}}'],
    welcome_signup: ['{{full_name}}', '{{club_name}}'],
  }

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
      setMessage(`Invalid admin tab: "${routeTab}". Redirecting to practice tab.`)
      navigate('/admin/practice', { replace: true })
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

  const handleExportActivityCsv = async () => {
    try {
      const params = buildActivityFilterParams({ limit: '5000' })
      const res = await fetch(apiUrl(`/api/admin/activity-events/export?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessage(data?.detail || 'Failed to export activity events')
        return
      }

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const disposition = res.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="?([^\"]+)"?/) 
      link.href = downloadUrl
      link.download = filenameMatch?.[1] || 'activity-events.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error('Error exporting activity events:', err)
      setMessage('Error exporting activity events')
    }
  }

  const buildActivityFilterParams = (overrides = {}) => {
    const params = new URLSearchParams({ limit: '250' })
    const searchValue = Object.prototype.hasOwnProperty.call(overrides, 'q') ? overrides.q : activitySearchTerm
    const startDateValue = Object.prototype.hasOwnProperty.call(overrides, 'start_date') ? overrides.start_date : activityStartDate
    const endDateValue = Object.prototype.hasOwnProperty.call(overrides, 'end_date') ? overrides.end_date : activityEndDate
    const userValue = Object.prototype.hasOwnProperty.call(overrides, 'user_email') ? overrides.user_email : activitySelectedUser
    const eventTypeValue = Object.prototype.hasOwnProperty.call(overrides, 'event_type') ? overrides.event_type : activitySelectedEventType
    const successValue = Object.prototype.hasOwnProperty.call(overrides, 'success') ? overrides.success : activitySelectedSuccess

    if ((searchValue || '').trim()) params.set('q', searchValue.trim())
    if (startDateValue) params.set('start_date', startDateValue)
    if (endDateValue) params.set('end_date', endDateValue)
    if (userValue) params.set('user_email', userValue)
    if (eventTypeValue) params.set('event_type', eventTypeValue)
    if (successValue) params.set('success', successValue)

    return params
  }

  const loadActivityEvents = async (overrides = {}) => {
    setActivityLoading(true)
    try {
      const params = buildActivityFilterParams(overrides)

      const res = await fetch(apiUrl(`/api/admin/activity-events?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => [])
      if (!res.ok) {
        setMessage(data?.detail || 'Failed to load activity events')
        return
      }
      setActivityEvents(data)
    } catch (err) {
      console.error('Error loading activity events:', err)
      setMessage('Error loading activity events')
    } finally {
      setActivityLoading(false)
    }
  }

  const refreshTabData = (tabName) => {
    if (tabName === 'event') loadEvents()
    else if (tabName === 'practice') loadPracticeSessions()
    else if (tabName === 'forum') loadForumPosts()
    else if (tabName === 'users') loadUsers()
    else if (tabName === 'notifications' && isSuperAdmin) loadNotificationSettings()
    else if (tabName === 'activity' && isSuperAdmin) loadActivityEvents()
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
      } else if (activeTab === 'practice') {
        loadPracticeSessions()
        newLoadedTabs.add('practice')
        didLoadTab = true
      } else if (activeTab === 'forum') {
        loadForumPosts()
        newLoadedTabs.add('forum')
        didLoadTab = true
      } else if (activeTab === 'users') {
        loadUsers()
        newLoadedTabs.add('users')
        didLoadTab = true
      } else if (activeTab === 'notifications' && isSuperAdmin) {
        loadNotificationSettings()
        newLoadedTabs.add('notifications')
        didLoadTab = true
      } else if (activeTab === 'activity' && isSuperAdmin) {
        loadActivityEvents()
        newLoadedTabs.add('activity')
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
    setPracticeMaximumCapacity('18')
    setPracticeInlineStatus('')
  }

  const resetForumPostForm = () => {
    setEditingForumPostId(null)
    setForumPostContent('')
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
      type: new Date(eventDate) > new Date() ? 'upcoming' : 'past',
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
        setMessage(delData?.detail || 'Failed to update practice (delete old)')
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
      setMessage(data?.detail || 'Failed to save practice session')
      return
    }
    setMessage(isEditingPractice ? 'Practice session updated.' : 'Practice session created.')
    resetPracticeForm()
    setPracticeInlineStatus(isEditingPractice ? 'Record updated successfully!' : 'New Practice Session Added !')
    refreshTabData('practice')
  }

  const handleEditPractice = (s) => {
    setActiveTab('practice')
    setPracticeInlineStatus('')
    setEditingPracticeDate(s.date)
    setPracticeDate(s.date || '')
    setPracticeTime(s.time || '')
    setPracticeLocation(s.location || '')
    setPracticeMaximumCapacity((s.maximum_capacity || 100).toString())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeletePractice = async (dateStr) => {
    if (!confirm('Delete this practice session?')) return
    const res = await fetch(apiUrl(`/api/practice/${dateStr}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.detail || 'Failed to delete practice session')
      return
    }
    setMessage('Practice session deleted.')
    refreshTabData('practice')
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

  const activitySearchLower = activitySearchTerm.trim().toLowerCase()
  const filteredActivityEvents = [...activityEvents].filter((event) => {
    if (!activitySearchLower) return true
    const haystack = [
      event.user_email,
      event.event_type,
      event.page_path,
      event.action,
      event.target_type,
      event.target_label,
      event.target_name,
      event.target_value,
      event.session_id,
      event.success ? 'success true yes' : 'failure false no',
      event.occurred_at,
      event.created_at,
      event.metadata_json,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(activitySearchLower)
  })

  const activityUserOptions = [...new Set(activityEvents.map((event) => event.user_email).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const activityEventTypeOptions = [...new Set(activityEvents.map((event) => event.event_type).filter(Boolean))].sort((a, b) => a.localeCompare(b))

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

  const upcomingPracticeSessions = practiceSessions
    .filter((s) => new Date(`${s.date}T00:00:00`) >= todayAtMidnight)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const pastPracticeSessions = practiceSessions
    .filter((s) => new Date(`${s.date}T00:00:00`) < todayAtMidnight)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

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
                <div style={{ opacity: 0.8, marginBottom: '0.35rem', fontSize: '0.9rem' }}>Time: {ev.time || 'TBD'}</div>
                {ev.location && <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Location: {ev.location}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'practice' && (
        <>
          <form onSubmit={handleSubmitPractice} style={{ 
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nav-btn" type="submit" style={{ background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: '600' }}>{editingPracticeDate ? 'Update Practice' : 'Add Practice'}</button>
              {(editingPracticeDate || practiceDate || practiceTime !== '21:00' || practiceLocation || practiceMaximumCapacity !== '18') && (
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
                  onClick={() => navigate(`/book-practice?date=${encodeURIComponent(s.date)}`)}
                  style={{ border: '1px solid #d1d5db', padding: '1rem', borderRadius: 8, background: '#fafafa', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{s.date}</strong>
                    <div>
                      <button className="nav-btn" onClick={(e) => { e.stopPropagation(); handleEditPractice(s) }} style={{ marginRight: 8, border: '1px solid #d1d5db', color: '#111827' }}>
                        Edit
                      </button>
                      <button
                        className="nav-btn"
                        onClick={(e) => { e.stopPropagation(); handleDeletePractice(s.date) }}
                        disabled={practiceListTab === 'past'}
                        style={{
                          background: practiceListTab === 'past' ? '#d1d5db' : '#ef4444',
                          color: 'white',
                          border: practiceListTab === 'past' ? '1px solid #d1d5db' : '1px solid #ef4444',
                          cursor: practiceListTab === 'past' ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div style={{ opacity: 0.8, marginTop: 6 }}>Time: {s.time || 'TBD'}</div>
                  <div style={{ opacity: 0.8 }}>Location: {s.location || 'TBD'}</div>
                  <div style={{ opacity: 0.8 }}>Maximum Capacity: {s.maximum_capacity || 100}</div>
                  {practiceListTab === 'past' && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Past practice records can be edited but not deleted.
                    </div>
                  )}
                </div>
              ))}
              {(practiceListTab === 'upcoming' ? upcomingPracticeSessions : pastPracticeSessions).length === 0 && (
                <p>{practiceListTab === 'upcoming' ? 'No upcoming practice sessions.' : 'No past practice sessions.'}</p>
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
          <h3>Registered Users</h3>
          <div style={{ marginTop: '1rem' }}>
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
            {filteredUsers.map((u) => (
              <div 
                key={u.email} 
                style={{ 
                  border: u.email === user?.email ? '1px solid #86efac' : '1px solid #d1d5db',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: u.email === user?.email ? '#f0fdf4' : 'white'
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
            ))}
            {filteredUsers.length === 0 && <p style={{ marginTop: '1rem', textAlign: 'center', color: '#6b7280' }}>No users found.</p>}
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

      {activeTab === 'activity' && isSuperAdmin && (
        <>
          <h3>User Activity</h3>
          <p style={{ color: '#6b7280', maxWidth: '900px' }}>
            Review recent user journey and interaction events. Use the search box to filter across email, page, action,
            target details, success or failure state, session id, and metadata.
          </p>

          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <input
                type="date"
                value={activityStartDate}
                onChange={(e) => setActivityStartDate(e.target.value)}
                style={{ padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #d1d5db', background: 'white' }}
              />
              <input
                type="date"
                value={activityEndDate}
                onChange={(e) => setActivityEndDate(e.target.value)}
                style={{ padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #d1d5db', background: 'white' }}
              />
              <select
                value={activitySelectedUser}
                onChange={(e) => setActivitySelectedUser(e.target.value)}
                style={{ padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #d1d5db', background: 'white' }}
              >
                <option value="">All users</option>
                {activityUserOptions.map((email) => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
              <select
                value={activitySelectedEventType}
                onChange={(e) => setActivitySelectedEventType(e.target.value)}
                style={{ padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #d1d5db', background: 'white' }}
              >
                <option value="">All event types</option>
                {activityEventTypeOptions.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
              <select
                value={activitySelectedSuccess}
                onChange={(e) => setActivitySelectedSuccess(e.target.value)}
                style={{ padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #d1d5db', background: 'white' }}
              >
                <option value="">All results</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={activitySearchTerm}
              onChange={(e) => setActivitySearchTerm(e.target.value)}
              placeholder="Search activity by user, page, action, target, success/failure, or metadata"
              style={{
                flex: '1 1 420px',
                minWidth: '260px',
                padding: '0.875rem 1rem',
                borderRadius: '0.625rem',
                border: '1px solid #d1d5db',
                background: 'white',
              }}
            />
            <button
              className="nav-btn"
              onClick={() => loadActivityEvents()}
              disabled={activityLoading}
              style={{ background: '#10b981', color: 'white', border: '1px solid #10b981' }}
            >
              {activityLoading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              className="nav-btn"
              onClick={handleExportActivityCsv}
              style={{ border: '1px solid #2563eb', color: 'white', background: '#2563eb' }}
            >
              Export CSV
            </button>
            <button
              className="nav-btn"
              onClick={() => {
                setActivitySearchTerm('')
                setActivityStartDate('')
                setActivityEndDate('')
                setActivitySelectedUser('')
                setActivitySelectedEventType('')
                setActivitySelectedSuccess('')
                loadActivityEvents({ q: '', start_date: '', end_date: '', user_email: '', event_type: '', success: '' })
              }}
              style={{ border: '1px solid #d1d5db', color: '#111827', background: 'white' }}
            >
              Clear Filters
            </button>
            </div>
          </div>

          <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Showing {filteredActivityEvents.length} of {activityEvents.length} loaded activity events
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: '0.75rem', background: 'white', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>When</th>
                  <th style={{ padding: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>User</th>
                  <th style={{ padding: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>Page</th>
                  <th style={{ padding: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>Event Type</th>
                  <th style={{ padding: '0.85rem', borderBottom: '1px solid #e5e7eb', width: '120px', maxWidth: '120px' }}>Action</th>
                  <th style={{ padding: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>Target</th>
                  <th style={{ padding: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>Result</th>
                  <th style={{ padding: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>Session</th>
                  <th style={{ padding: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivityEvents.map((event) => (
                  <tr key={event.id} style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                    <td style={{ padding: '0.85rem', color: '#374151', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                      {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : event.created_at ? new Date(event.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '0.85rem', color: '#111827', fontSize: '0.9rem', wordBreak: 'break-word' }}>{event.user_email}</td>
                    <td style={{ padding: '0.85rem', color: '#111827', fontSize: '0.9rem', wordBreak: 'break-word' }}>{event.page_path}</td>
                    <td style={{ padding: '0.85rem', color: '#111827', fontSize: '0.9rem' }}>{event.event_type}</td>
                    <td style={{ padding: '0.85rem', color: '#111827', fontSize: '0.9rem', width: '120px', maxWidth: '120px', wordBreak: 'break-word' }}>{event.action}</td>
                    <td style={{ padding: '0.85rem', color: '#374151', fontSize: '0.9rem' }}>
                      <div><strong>Type:</strong> {event.target_type || 'N/A'}</div>
                      <div><strong>Label:</strong> {event.target_label || 'N/A'}</div>
                      <div><strong>Name:</strong> {event.target_name || 'N/A'}</div>
                      <div><strong>Value:</strong> {event.target_value || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '0.85rem', fontSize: '0.9rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        fontWeight: '600',
                        background: event.success ? '#dcfce7' : '#fee2e2',
                        color: event.success ? '#166534' : '#991b1b',
                      }}>
                        {event.success ? 'Success' : 'Failure'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem', color: '#374151', fontSize: '0.9rem', wordBreak: 'break-word' }}>{event.session_id || 'N/A'}</td>
                    <td style={{ padding: '0.85rem', color: '#374151', fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '320px' }}>
                      {event.metadata_json || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!activityLoading && filteredActivityEvents.length === 0 && (
            <p style={{ marginTop: '1rem', textAlign: 'center', color: '#6b7280' }}>
              No activity events found for the current filter.
            </p>
          )}
        </>
      )}
    </div>
  )
}
