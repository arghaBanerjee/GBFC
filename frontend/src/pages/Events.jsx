import { useState, useEffect } from 'react'
import { apiUrl } from '../api'
import '../styles/UserActions.css'

const pastelColors = ['#FFE4E1', '#E6E6FA', '#E0FFF4', '#FFF8DC', '#F0FFF0']
const upcomingPastelColors = ['#E0FFFF', '#FFF0F5', '#F0FFF0', '#FFF5EE', '#F5F5DC']

// Render description with links and images (URLs on separate lines)
function renderDescription(text) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (!line.trim()) return <br key={i} />
    // Simple image detection (common image file extensions)
    if (/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(line.trim())) {
      return <img key={i} src={line.trim()} alt="Event" style={{ maxWidth: '100%', borderRadius: '0.5rem', marginTop: '0.5rem' }} />
    }
    // Simple link detection
    if (/^https?:\/\//.test(line.trim())) {
      return <a key={i} href={line.trim()} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a', textDecoration: 'underline' }}>{line.trim()}</a>
    }
    // Detect inline URLs within text
    const parts = line.split(/(https?:\/\/[^\s]+)/g)
    if (parts.length > 1) {
      return (
        <span key={i}>
          {parts.map((part, j) =>
            /^https?:\/\//.test(part) ? (
              <a key={j} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a', textDecoration: 'underline' }}>{part}</a>
            ) : (
              part
            )
          )}
        </span>
      )
    }
    return <span key={i}>{line}</span>
  })
}

// Extract YouTube video ID and return embed URL
function getYouTubeEmbedUrl(url) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

export default function Events({ user }) {
  const [events, setEvents] = useState([])
  const [tab, setTab] = useState('upcoming')
  const [commentingEventId, setCommentingEventId] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [likesHover, setLikesHover] = useState(null)
  const [myLikedEventIds, setMyLikedEventIds] = useState(new Set())
  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch(apiUrl('/api/events'))
      .then((r) => r.json())
      .then(setEvents)
  }, [])

  useEffect(() => {
    if (!user || !token) {
      setMyLikedEventIds(new Set())
      return
    }
    fetch(apiUrl('/api/events/likes/me'), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => r.json())
      .then((ids) => setMyLikedEventIds(new Set(ids || [])))
      .catch(() => setMyLikedEventIds(new Set()))
  }, [user])

  const filtered = events.filter((e) => e.type === tab).sort((a, b) => {
    // For upcoming: ascending (nearest first)
    // For past: descending (most recent first)
    if (tab === 'upcoming') {
      return new Date(a.date) - new Date(b.date)
    } else {
      return new Date(b.date) - new Date(a.date)
    }
  })

  const refreshEventsAndLikes = async () => {
    const updated = await fetch(apiUrl('/api/events'))
    setEvents(await updated.json())
    if (user && token) {
      const likesRes = await fetch(apiUrl('/api/events/likes/me'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (likesRes.ok) setMyLikedEventIds(new Set(await likesRes.json()))
    }
  }

  const handleLikeToggle = async (eventId) => {
    if (!user) return alert('Please log in to like')

    const alreadyLiked = myLikedEventIds.has(eventId)
    await fetch(apiUrl(`/api/events/${eventId}/like`), {
      method: alreadyLiked ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    await refreshEventsAndLikes()
  }

  const sanitizeInput = (text) => {
    // Basic XSS prevention - escape HTML special characters
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  const renderCommentWithLinks = (text) => {
    // Detect URLs and convert to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)
    
    return parts.map((part, idx) => {
      // Check if this part is a URL by testing against the regex
      if (part.match(/^https?:\/\//)) {
        return (
          <a 
            key={idx} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: '#2563eb', textDecoration: 'underline' }}
          >
            {part}
          </a>
        )
      }
      // For non-URL text, return as plain text (React automatically escapes it)
      return <span key={idx}>{part}</span>
    })
  }

  const handleComment = async () => {
    if (!user) return alert('Please log in to comment')
    if (!commentText.trim()) return
    
    // Limit comment to 100 characters
    if (commentText.length > 100) {
      return alert('Comment must be 100 characters or less')
    }
    
    // Send comment without sanitization - renderCommentWithLinks handles safe rendering
    await fetch(apiUrl(`/api/events/${commentingEventId}/comments`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ comment: commentText }),
    })
    setCommentText('')
    setCommentingEventId(null)
    // Refetch events to get updated comments
    const updated = await fetch(apiUrl('/api/events'))
    setEvents(await updated.json())
  }

  return (
    <div className="container">
      <h2>Matches</h2>
      <div className="tabs">
        <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming Matches
        </button>
        <button className={`tab-btn ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
          Past Matches
        </button>
      </div>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {filtered.map((event, idx) => {
          const colors = tab === 'past' ? pastelColors : upcomingPastelColors
          const bg = colors[idx % colors.length]
          const youtubeEmbed = getYouTubeEmbedUrl(event.youtube_url)
          const likesCount = event.likes ? event.likes.length : 0
          const commentsCount = event.comments ? event.comments.length : 0
          return (
            <div key={event.id} style={{ backgroundColor: bg, padding: '1rem', borderRadius: '0.75rem', border: '1px solid #ddd' }}>
              <h4>{event.name}</h4>
              <p>📅 {event.date} {event.time}</p>
              {event.location && <p>📍 {event.location}</p>}
              {event.image_url && <img src={event.image_url} alt="Event" style={{ maxHeight: '600px', width: 'auto', maxWidth: '100%', borderRadius: '0.5rem', marginTop: '0.5rem', objectFit: 'contain' }} />}
              {youtubeEmbed && (
                <div style={{ marginTop: '0.5rem', maxWidth: '560px' }}>
                  <iframe
                    width="100%"
                    height="315"
                    src={youtubeEmbed}
                    title="YouTube video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ borderRadius: '0.5rem' }}
                  />
                </div>
              )}
              {event.description && (
                <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-line' }}>
                  <p style={{ margin: '0.5rem 0', wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{renderDescription(event.description)}</p>
                </div>
              )}
              <div style={{ marginTop: '0.5rem', position: 'relative' }}>
                <button
                  className={`nav-btn ${myLikedEventIds.has(event.id) ? 'active' : ''}`}
                  onClick={() => handleLikeToggle(event.id)}
                  style={{ 
                    marginRight: '0.5rem', 
                    border: 'none',
                    background: myLikedEventIds.has(event.id) ? '#10b981' : '#f3f4f6',
                    color: myLikedEventIds.has(event.id) ? 'white' : 'inherit',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 1rem',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={() => setLikesHover(event.id)}
                  onMouseLeave={() => setLikesHover(null)}
                >
                  {myLikedEventIds.has(event.id) ? '❤️' : '🤍'} Like ({likesCount})
                </button>
                <button 
                  className="nav-btn" 
                  onClick={() => setCommentingEventId(commentingEventId === event.id ? null : event.id)} 
                  style={{ 
                    border: 'none',
                    background: '#f3f4f6',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 1rem',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  💬 Comment ({commentsCount})
                </button>
                {/* Hover tooltip for likes */}
                {likesHover === event.id && event.likes && event.likes.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    background: '#111827',
                    color: 'white',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    zIndex: 10,
                    marginBottom: '0.25rem',
                    maxWidth: '200px',
                  }}>
                    {event.likes.map((l, idx) => (
                      <div key={idx}>{l.full_name || l.user_email}</div>
                    ))}
                  </div>
                )}
              </div>
              {/* Comments section */}
              {(commentingEventId === event.id || commentsCount > 0) && (
                <div style={{ marginTop: '1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', overflow: 'hidden' }}>
                  {commentingEventId === event.id && (
                    <div style={{ padding: '1rem', background: `${bg}dd`, borderBottom: '1px solid #d1d5db' }}>
                      <div style={{ width: '100%', marginBottom: '0.75rem' }}>
                        <textarea
                          rows={3}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Write a comment..."
                          maxLength={100}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '1rem', background: 'white' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'right', marginTop: '0.25rem' }}>
                          {commentText.length}/100 characters
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="nav-btn active" onClick={handleComment} style={{ padding: '0.5rem 1rem' }}>Post</button>
                        <button className="nav-btn" onClick={() => { setCommentingEventId(null); setCommentText('') }} style={{ padding: '0.5rem 1rem', background: '#f3f4f6' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {/* Show existing comments */}
                  {event.comments && event.comments.length > 0 && (
                    <div style={{ 
                      padding: '1rem',
                      background: '#f9fafb',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {[...event.comments].reverse().map((c) => {
                        const firstName = (c.full_name || c.user_email).split(' ')[0]
                        return (
                          <p key={c.id} style={{ margin: '0.5rem 0', wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                            <small>
                              <strong>{firstName}:</strong> {renderCommentWithLinks(c.comment)}
                            </small>
                          </p>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
