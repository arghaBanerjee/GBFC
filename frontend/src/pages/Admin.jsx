import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../api'

export default function Admin({ user, loading }) {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  // Admin check: user_type is 'admin' OR email is 'super@admin.com'
  const isAdmin = user && (user.user_type === 'admin' || user.email === 'super@admin.com')

  const [activeTab, setActiveTab] = useState('event')
  const [message, setMessage] = useState('')

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
  const [practiceTime, setPracticeTime] = useState('')
  const [practiceLocation, setPracticeLocation] = useState('')

  // Forum posts
  const [forumPosts, setForumPosts] = useState([])
  const [editingForumPostId, setEditingForumPostId] = useState(null)
  const [forumPostContent, setForumPostContent] = useState('')

  // Users
  const [users, setUsers] = useState([])
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingUserName, setEditingUserName] = useState('')

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

  useEffect(() => {
    if (!isAdmin) return
    loadEvents()
    loadPracticeSessions()
    loadForumPosts()
    loadUsers()
  }, [isAdmin])

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
    setPracticeTime('')
    setPracticeLocation('')
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
    loadEvents()
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
    loadEvents()
  }

  const handleSubmitPractice = async (e) => {
    e.preventDefault()

    const payload = { date: practiceDate, time: practiceTime, location: practiceLocation }

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
    setMessage(editingPracticeDate ? 'Practice session updated.' : 'Practice session created.')
    resetPracticeForm()
    loadPracticeSessions()
  }

  const handleEditPractice = (s) => {
    setActiveTab('practice')
    setEditingPracticeDate(s.date)
    setPracticeDate(s.date || '')
    setPracticeTime(s.time || '')
    setPracticeLocation(s.location || '')
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
    loadPracticeSessions()
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
    loadForumPosts()
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
    loadForumPosts()
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
    setMessage(`User type updated to ${userType}.`)
    loadUsers()
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
    loadUsers()
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
    loadUsers()
    loadForumPosts()
  }

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

      <div style={{ 
        marginBottom: '1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.75rem',
        maxWidth: '600px'
      }}>
        <button 
          className={`nav-btn ${activeTab === 'event' ? 'active' : ''}`} 
          onClick={() => setActiveTab('event')}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem'
          }}
        >
          Add Match
        </button>
        <button 
          className={`nav-btn ${activeTab === 'practice' ? 'active' : ''}`} 
          onClick={() => setActiveTab('practice')}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem'
          }}
        >
          Add Practice
        </button>
        <button 
          className={`nav-btn ${activeTab === 'forum' ? 'active' : ''}`} 
          onClick={() => setActiveTab('forum')}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem'
          }}
        >
          Forum Posts
        </button>
        <button 
          className={`nav-btn ${activeTab === 'users' ? 'active' : ''}`} 
          onClick={() => setActiveTab('users')}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '0.95rem'
          }}
        >
          Users
        </button>
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
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '1.05rem' }}>{ev.name}</strong>
                </div>
                <div style={{ opacity: 0.8, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{ev.date} {ev.time || ''}</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="nav-btn" onClick={() => handleEditEvent(ev)} style={{ flex: '1', minWidth: '100px', border: '1px solid #d1d5db' }}>
                    Edit
                  </button>
                  <button className="nav-btn" onClick={() => handleDeleteEvent(ev.id)} style={{ flex: '1', minWidth: '100px', background: '#ef4444', color: 'white', border: '#ef4444' }}>
                    Delete
                  </button>
                </div>
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
              <label>Practice Date</label>
              <input type="date" value={practiceDate} onChange={(e) => setPracticeDate(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div>
              <label>Practice Time</label>
              <input value={practiceTime} onChange={(e) => setPracticeTime(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Practice Location</label>
              <input value={practiceLocation} onChange={(e) => setPracticeLocation(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nav-btn" type="submit" style={{ background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: '600' }}>{editingPracticeDate ? 'Update Practice' : 'Add Practice'}</button>
              {(editingPracticeDate || practiceDate || practiceTime || practiceLocation) && (
                <button className="nav-btn" type="button" onClick={resetPracticeForm} style={{ background: '#6b7280', color: 'white', border: '1px solid #6b7280', fontWeight: '600' }}>
                  Clear
                </button>
              )}
            </div>
          </form>

          <h3 style={{ marginTop: '2rem' }}>Upcoming practice sessions</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {practiceSessions
              .filter(s => new Date(s.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((s) => (
              <div key={s.date} style={{ border: '1px solid #d1d5db', padding: '1rem', borderRadius: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <strong>{s.date}</strong>
                  <div>
                    <button className="nav-btn" onClick={() => handleEditPractice(s)} style={{ marginRight: 8, border: '1px solid #d1d5db' }}>
                      Edit
                    </button>
                    <button className="nav-btn" onClick={() => handleDeletePractice(s.date)} style={{ background: '#ef4444', color: 'white', border: '#ef4444' }}>
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>Time: {s.time || 'TBD'}</div>
                <div style={{ opacity: 0.8 }}>Location: {s.location || 'TBD'}</div>
              </div>
            ))}
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
                <button className="nav-btn" type="submit">Update Post</button>
                <button className="nav-btn" type="button" onClick={resetForumPostForm}>Cancel</button>
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
                    <button className="nav-btn" onClick={() => handleEditForumPost(p)} style={{ marginRight: 8, border: '1px solid #d1d5db' }}>
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
            {users.map((u) => (
              <div 
                key={u.email} 
                style={{ 
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: 'white'
                }}
              >
                <div>
                  {/* Name and Edit UI */}
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
                      <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                        {u.full_name}
                      </div>
                    )}
                  </div>
                  
                  {/* Member/Admin Tags */}
                  {u.email === user?.email ? (
                    // Current logged-in user - show only their current role (non-clickable)
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '0.25rem', 
                        fontSize: '0.875rem',
                        background: '#10b981',
                        color: 'white',
                        fontWeight: '600',
                        display: 'inline-block'
                      }}>
                        {u.user_type === 'admin' ? 'Admin' : 'Member'}
                      </span>
                    </div>
                  ) : (
                    // Other users - show toggle buttons
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <button
                        onClick={() => handleUpdateUserType(u.email, 'member')}
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.875rem',
                          background: u.user_type === 'member' ? '#10b981' : '#f3f4f6',
                          color: u.user_type === 'member' ? 'white' : '#374151',
                          border: u.user_type === 'member' ? '1px solid #10b981' : '1px solid #d1d5db',
                          cursor: 'pointer',
                          fontWeight: u.user_type === 'member' ? '600' : '400'
                        }}
                      >
                        Member
                      </button>
                      <button
                        onClick={() => handleUpdateUserType(u.email, 'admin')}
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.875rem',
                          background: u.user_type === 'admin' ? '#10b981' : '#f3f4f6',
                          color: u.user_type === 'admin' ? 'white' : '#374151',
                          border: u.user_type === 'admin' ? '1px solid #10b981' : '1px solid #d1d5db',
                          cursor: 'pointer',
                          fontWeight: u.user_type === 'admin' ? '600' : '400'
                        }}
                      >
                        Admin
                      </button>
                    </div>
                  )}
                  
                  {/* Email */}
                  <div style={{ color: '#6b7280', fontSize: '0.875rem', wordBreak: 'break-word' }}>
                    {u.email}
                  </div>
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
                  {u.email !== user?.email && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="nav-btn" 
                        onClick={() => {
                          setEditingUserId(u.email)
                          setEditingUserName(u.full_name)
                        }}
                        style={{ 
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          border: '1px solid #d1d5db'
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        className="nav-btn" 
                        onClick={() => handleDeleteUser(u.email)}
                        style={{ 
                          background: '#ef4444', 
                          color: 'white', 
                          border: '1px solid #ef4444',
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && <p style={{ marginTop: '1rem', textAlign: 'center', color: '#6b7280' }}>No users found.</p>}
          </div>
        </>
      )}
    </div>
  )
}
