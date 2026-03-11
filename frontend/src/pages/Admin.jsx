import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Admin({ user }) {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const isAdmin = user && user.email === 'admin@example.com'

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

  useEffect(() => {
    if (!user) navigate('/login')
    else if (!isAdmin) setMessage('Access denied: Admins only')
  }, [user, navigate, isAdmin])

  const loadEvents = async () => {
    const res = await fetch('/api/events')
    if (res.ok) setEvents(await res.json())
  }

  const loadPracticeSessions = async () => {
    const res = await fetch('/api/practice/sessions')
    if (res.ok) setPracticeSessions(await res.json())
  }

  const loadForumPosts = async () => {
    const res = await fetch('/api/forum')
    if (res.ok) setForumPosts(await res.json())
  }

  useEffect(() => {
    if (!isAdmin) return
    loadEvents()
    loadPracticeSessions()
    loadForumPosts()
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
      const res = await fetch('/api/upload-image', {
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
    const res = await fetch(editingEventId ? `/api/events/${editingEventId}` : '/api/events', {
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
    const res = await fetch(`/api/events/${id}`, {
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
      const del = await fetch(`/api/practice/${editingPracticeDate}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!del.ok) {
        const delData = await del.json().catch(() => ({}))
        setMessage(delData?.detail || 'Failed to update practice (delete old)')
        return
      }
      res = await fetch('/api/practice/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
    } else if (editingPracticeDate) {
      res = await fetch(`/api/practice/sessions/${editingPracticeDate}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/practice/sessions', {
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
    const res = await fetch(`/api/practice/${dateStr}`, {
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

    const res = await fetch(`/api/forum/${editingForumPostId}`, {
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
    const res = await fetch(`/api/forum/${postId}`, {
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

      <div style={{ marginBottom: '1rem' }}>
        <button className={`nav-btn ${activeTab === 'event' ? 'active' : ''}`} onClick={() => setActiveTab('event')}>
          Create Event
        </button>
        <button className={`nav-btn ${activeTab === 'practice' ? 'active' : ''}`} onClick={() => setActiveTab('practice')}>
          Create Practice
        </button>
        <button className={`nav-btn ${activeTab === 'forum' ? 'active' : ''}`} onClick={() => setActiveTab('forum')}>
          Forum Posts
        </button>
      </div>

      {activeTab === 'event' && (
        <>
          <form onSubmit={handleSubmitEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 600 }}>
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
              <button className="nav-btn" type="submit">{editingEventId ? 'Update Event' : 'Create Event'}</button>
              {editingEventId && (
                <button className="nav-btn" type="button" onClick={resetEventForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <h3 style={{ marginTop: '2rem' }}>Existing Events</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ border: '1px solid #d1d5db', padding: '1rem', borderRadius: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <strong>{ev.name}</strong>
                  <div>
                    <button className="nav-btn" onClick={() => handleEditEvent(ev)} style={{ marginRight: 8 }}>
                      Edit
                    </button>
                    <button className="nav-btn" onClick={() => handleDeleteEvent(ev.id)} style={{ background: '#ef4444', color: 'white', border: '#ef4444' }}>
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>{ev.date} {ev.time || ''}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'practice' && (
        <>
          <form onSubmit={handleSubmitPractice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 600 }}>
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
              <button className="nav-btn" type="submit">{editingPracticeDate ? 'Update Practice' : 'Create Practice'}</button>
              {(editingPracticeDate || practiceDate || practiceTime || practiceLocation) && (
                <button className="nav-btn" type="button" onClick={resetPracticeForm}>
                  Clear
                </button>
              )}
            </div>
          </form>

          <h3 style={{ marginTop: '2rem' }}>Existing Practice Sessions</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {practiceSessions.map((s) => (
              <div key={s.date} style={{ border: '1px solid #d1d5db', padding: '1rem', borderRadius: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <strong>{s.date}</strong>
                  <div>
                    <button className="nav-btn" onClick={() => handleEditPractice(s)} style={{ marginRight: 8 }}>
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
                    <button className="nav-btn" onClick={() => handleEditForumPost(p)} style={{ marginRight: 8 }}>
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
    </div>
  )
}
