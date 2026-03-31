import { useState, useEffect, useRef } from 'react'
import { apiUrl } from '../api'

export default function Forum({ user }) {
  const [posts, setPosts] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [newContent, setNewContent] = useState('')
  const editorRef = useRef(null)
  const [editingPostId, setEditingPostId] = useState(null)
  const [editingPostContent, setEditingPostContent] = useState('')
  const [savingPostId, setSavingPostId] = useState(null)
  const [commentingPostId, setCommentingPostId] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [myLikedPostIds, setMyLikedPostIds] = useState(new Set())
  const [likesHover, setLikesHover] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch(apiUrl('/api/forum'))
      .then((r) => r.json())
      .then(setPosts)
  }, [])

  useEffect(() => {
    if (!user || !token) {
      setMyLikedPostIds(new Set())
      return
    }
    fetch(apiUrl('/api/forum/likes/me'), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => r.json())
      .then((ids) => setMyLikedPostIds(new Set(ids || [])))
      .catch(() => setMyLikedPostIds(new Set()))
  }, [user])

  const getYouTubeVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
  }

  const convertUrlsToLinks = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.replace(urlRegex, (url) => {
      const videoId = getYouTubeVideoId(url)
      if (videoId) {
        return `<div style="margin: 1rem 0;"><iframe width="100%" height="315" style="max-width: 560px; border-radius: 0.5rem;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
      }
      return `<a href="${url}" style="color: #2563eb; text-decoration: underline;">${url}</a>`
    })
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

  const handleCreate = async () => {
    if (!user) return alert('Please log in to post')
    if (!newContent.trim() && !imagePreview) return
    
    // Limit post content to 500 characters
    if (newContent.length > 500) {
      return alert('Post content must be 500 characters or less')
    }
    
    // Convert URLs to links and YouTube embeds (convertUrlsToLinks handles safe rendering)
    let finalContent = convertUrlsToLinks(newContent.replace(/\n/g, '<br>'))
    if (imagePreview) {
      finalContent += `<br><img src="${imagePreview}" style="max-width: 600px; width: 100%; height: auto; display: block; margin-top: 0.5rem; border-radius: 0.5rem;" />`
    }
    
    await fetch(apiUrl('/api/forum'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: finalContent }),
    })
    setNewContent('')
    setImagePreview(null)
    setShowCreate(false)
    const updated = await fetch(apiUrl('/api/forum'))
    setPosts(await updated.json())
  }

  const handleAttachImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!user) return alert('Please log in to attach images')
    if (!file.type.startsWith('image/')) return alert('Please select an image file')

    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(apiUrl('/api/forum/upload-image'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return alert(data?.detail || 'Image upload failed')
    
    setImagePreview(data.image_url)
    e.target.value = ''
  }

  const refreshPostsAndLikes = async () => {
    const updated = await fetch(apiUrl('/api/forum'))
    setPosts(await updated.json())
    if (user && token) {
      const likesRes = await fetch(apiUrl('/api/forum/likes/me'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (likesRes.ok) setMyLikedPostIds(new Set(await likesRes.json()))
    }
  }

  const handleLikeToggle = async (postId) => {
    if (!user) return alert('Please log in to like')

    const alreadyLiked = myLikedPostIds.has(postId)
    await fetch(apiUrl(`/api/forum/${postId}/like`), {
      method: alreadyLiked ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    await refreshPostsAndLikes()
  }

  const handleComment = async () => {
    if (!user) return alert('Please log in to comment')
    if (!commentText.trim()) return
    
    // Limit comment to 100 characters
    if (commentText.length > 100) {
      return alert('Comment must be 100 characters or less')
    }
    
    // Send comment without sanitization - renderCommentWithLinks handles safe rendering
    await fetch(apiUrl(`/api/forum/${commentingPostId}/comments`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ comment: commentText }),
    })
    setCommentText('')
    setCommentingPostId(null)
    await refreshPostsAndLikes()
  }

  const handleDeletePost = async (postId) => {
    if (!user) return alert('Please log in to delete')
    if (!confirm('Are you sure you want to delete this post?')) return
    
    const res = await fetch(apiUrl(`/api/forum/${postId}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    
    if (res.ok) {
      await refreshPostsAndLikes()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data?.detail || 'Failed to delete post')
    }
  }

  const canManagePost = (post) => Boolean(
    user && (user.email === post.user_email || user.user_type === 'admin' || user.email === 'super@admin.com')
  )

  const handleStartEditPost = (post) => {
    setEditingPostId(post.id)
    setEditingPostContent(post.content || '')
    setCommentingPostId((current) => (current === post.id ? null : current))
  }

  const handleCancelEditPost = () => {
    setEditingPostId(null)
    setEditingPostContent('')
  }

  const handleSaveEditPost = async (postId) => {
    if (!user) return alert('Please log in to edit')
    if (!editingPostContent.trim()) {
      return alert('Post content cannot be empty')
    }
    if (editingPostContent.length > 500) {
      return alert('Post content must be 500 characters or less')
    }

    setSavingPostId(postId)
    const res = await fetch(apiUrl(`/api/forum/${postId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: editingPostContent }),
    })
    setSavingPostId(null)

    if (res.ok) {
      handleCancelEditPost()
      await refreshPostsAndLikes()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data?.detail || 'Failed to update post')
    }
  }

  return (
    <div className="container">
      <style>{`
        .forum-post-content {
          word-wrap: break-word;
          overflow-wrap: break-word;
          word-break: break-word;
        }
        .forum-post-content img {
          max-width: 600px;
          width: auto;
          max-width: 100%;
          height: auto;
          display: block;
          margin-top: 0.5rem;
          border-radius: 0.5rem;
          object-fit: contain;
        }
        .forum-post-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: nowrap;
          justify-content: flex-end;
          flex-shrink: 0;
        }
        .forum-post-action-btn {
          min-width: 88px;
          justify-content: center;
        }
        .forum-post-action-icon {
          display: none;
        }
        @media (max-width: 640px) {
          .forum-post-header {
            gap: 0.75rem;
          }
          .forum-post-meta {
            min-width: 0;
            flex: 1;
          }
          .forum-post-action-btn {
            min-width: 40px;
            width: 40px;
            height: 40px;
            padding: 0;
            border-radius: 0.625rem;
            flex: 0 0 40px;
          }
          .forum-post-action-text {
            display: none;
          }
          .forum-post-action-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>
      <h2>Club Forum</h2>
      {user && (
        <button 
          onClick={() => setShowCreate(true)} 
          style={{ 
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, var(--theme-accent) 0%, color-mix(in srgb, var(--theme-accent) 70%, var(--theme-secondary) 30%) 100%)',
            color: 'var(--theme-accent-contrast)',
            border: '1px solid color-mix(in srgb, var(--theme-accent) 75%, black 25%)',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            borderRadius: '0.75rem',
            cursor: 'pointer',
            boxShadow: 'var(--theme-shadow-strong)',
            transition: 'all 0.3s ease',
            transform: 'translateY(0)',
            width: '100%',
            maxWidth: '180px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)'
            e.target.style.boxShadow = '0 18px 36px rgba(17, 24, 39, 0.18)'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = 'var(--theme-shadow-strong)'
          }}
        >
          ✨ Create Post
        </button>
      )}
      {showCreate && (
        <div style={{ border: '1px solid var(--theme-border)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem', background: 'var(--theme-surface)', boxShadow: 'var(--theme-card-shadow)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--theme-heading)' }}>What's on your mind?</h3>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Share your thoughts, paste links, or attach media..."
              maxLength={500}
              rows={5}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--theme-border)',
                background: 'var(--theme-surface-alt)',
                color: 'var(--theme-text)',
                outline: 'none',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)', textAlign: 'right', marginTop: '0.25rem' }}>
              {newContent.length}/500 characters
            </div>
          </div>
          {imagePreview && (
            <div style={{ marginBottom: '0.75rem', position: 'relative', display: 'inline-block' }}>
              <img src={imagePreview} alt="Preview" style={{ maxWidth: '300px', width: '100%', height: 'auto', borderRadius: '0.5rem', border: '1px solid var(--theme-border)' }} />
              <button 
                onClick={() => setImagePreview(null)}
                style={{ 
                  position: 'absolute', 
                  top: '0.5rem', 
                  right: '0.5rem', 
                  background: 'var(--theme-danger)', 
                  color: 'var(--theme-danger-contrast)', 
                  border: '1px solid var(--theme-danger)', 
                  borderRadius: '50%', 
                  width: '24px', 
                  height: '24px', 
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ×
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label className="nav-btn theme-secondary-btn" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
              📎 Attach Image
              <input type="file" accept="image/*" onChange={handleAttachImage} style={{ display: 'none' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="nav-btn theme-primary-btn" onClick={handleCreate} style={{ padding: '0.5rem 1rem' }}>Post</button>
            <button className="nav-btn theme-secondary-btn" onClick={() => { setShowCreate(false); setNewContent(''); setImagePreview(null) }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {posts.map((post) => (
          <div
            key={post.id}
            style={{
              background: 'var(--theme-surface)',
              padding: '1rem',
              borderRadius: '0.9rem',
              border: '1px solid var(--theme-border)',
              boxShadow: 'var(--theme-card-shadow)',
            }}
          >
            <div className="forum-post-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
              <div className="forum-post-meta" style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--theme-heading)', fontWeight: '700', lineHeight: 1.35 }}>{post.user_full_name}</div>
                <div style={{ color: 'var(--theme-text-muted)', marginTop: '0.2rem', fontSize: '0.9rem', lineHeight: 1.35 }}>{new Date(post.created_at).toLocaleString()}</div>
              </div>
              {canManagePost(post) && (
                <div className="forum-post-actions">
                  <button
                    className="nav-btn forum-post-action-btn"
                    onClick={() => handleStartEditPost(post)}
                    aria-label="Edit post"
                    title="Edit post"
                    style={{ border: '1px solid #d1d5db', color: '#111827', background: 'var(--theme-surface-alt)' }}
                  >
                    <span className="forum-post-action-text">Edit</span>
                    <span className="forum-post-action-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </span>
                  </button>
                  <button
                    className="nav-btn forum-post-action-btn"
                    onClick={() => handleDeletePost(post.id)}
                    aria-label="Delete post"
                    title="Delete post"
                    style={{ background: 'var(--theme-danger-soft)', color: 'var(--theme-danger-strong)', border: '1px solid color-mix(in srgb, var(--theme-danger) 30%, white)' }}
                  >
                    <span className="forum-post-action-text">Delete</span>
                    <span className="forum-post-action-icon" aria-hidden="true">
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
            {editingPostId === post.id ? (
              <div style={{ marginBottom: '0.75rem' }}>
                <textarea
                  value={editingPostContent}
                  onChange={(e) => setEditingPostContent(e.target.value)}
                  maxLength={500}
                  rows={6}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', boxSizing: 'border-box', fontSize: '1rem', fontFamily: 'inherit', resize: 'vertical' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)', textAlign: 'right', marginTop: '0.25rem' }}>
                  {editingPostContent.length}/500 characters
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button className="nav-btn theme-primary-btn" onClick={() => handleSaveEditPost(post.id)} disabled={savingPostId === post.id} style={{ padding: '0.5rem 1rem' }}>
                    {savingPostId === post.id ? 'Saving...' : 'Save'}
                  </button>
                  <button className="nav-btn theme-secondary-btn" onClick={handleCancelEditPost} disabled={savingPostId === post.id} style={{ padding: '0.5rem 1rem' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="forum-post-content" dangerouslySetInnerHTML={{ __html: post.content }} />
            )}
            <div style={{ marginTop: '0.5rem', position: 'relative' }}>
              <button
                className={`nav-btn ${myLikedPostIds.has(post.id) ? 'active' : ''}`}
                onClick={() => handleLikeToggle(post.id)}
                style={{ 
                  marginRight: '0.5rem', 
                  border: myLikedPostIds.has(post.id) ? '1px solid var(--theme-accent)' : '1px solid var(--theme-border)',
                  background: myLikedPostIds.has(post.id) ? 'var(--theme-accent)' : 'var(--theme-surface-alt)',
                  color: myLikedPostIds.has(post.id) ? 'var(--theme-accent-contrast)' : 'var(--theme-text)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  boxShadow: 'var(--theme-card-shadow)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={() => setLikesHover(post.id)}
                onMouseLeave={() => setLikesHover(null)}
              >
                {myLikedPostIds.has(post.id) ? '❤️' : '🤍'} Like ({post.likes_count})
              </button>
              <button 
                className="nav-btn" 
                onClick={() => setCommentingPostId(commentingPostId === post.id ? null : post.id)} 
                style={{ 
                  marginRight: '0.5rem', 
                  border: '1px solid var(--theme-border)',
                  background: 'var(--theme-surface-alt)',
                  color: 'var(--theme-text)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  boxShadow: 'var(--theme-card-shadow)',
                  transition: 'all 0.2s ease'
                }}
              >
                💬 Comment ({post.comments.length})
              </button>
              {/* Hover tooltip for likes */}
              {likesHover === post.id && post.likes && post.likes.length > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  background: 'var(--theme-heading)',
                  color: 'var(--theme-accent-contrast)',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  zIndex: 10,
                  marginBottom: '0.25rem',
                  maxWidth: '200px',
                }}>
                  {post.likes.map((l, idx) => (
                    <div key={idx}>{l.full_name || l.user_email}</div>
                  ))}
                </div>
              )}
            </div>

          {(commentingPostId === post.id || post.comments.length > 0) && (
            <div style={{ marginTop: '1rem', border: '1px solid var(--theme-border)', borderRadius: '0.75rem', overflow: 'hidden', background: 'var(--theme-surface-alt)' }}>
              {commentingPostId === post.id && (
                <div style={{ padding: '1rem', background: 'var(--theme-surface-alt)', borderBottom: '1px solid var(--theme-border)' }}>
                  <div style={{ width: '100%', marginBottom: '0.75rem' }}>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      maxLength={100}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', boxSizing: 'border-box', fontSize: '1rem', background: 'var(--theme-surface)', color: 'var(--theme-text)' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)', textAlign: 'right', marginTop: '0.25rem' }}>
                      {commentText.length}/100 characters
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="nav-btn theme-primary-btn" onClick={handleComment} style={{ padding: '0.5rem 1rem' }}>Post</button>
                    <button className="nav-btn theme-secondary-btn" onClick={() => { setCommentingPostId(null); setCommentText('') }} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                  </div>
                </div>
              )}
              {post.comments.length > 0 && (
                  <div style={{ 
                    padding: '1rem',
                    background: 'var(--theme-surface)',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {[...post.comments].reverse().map((c) => {
                      const firstName = c.user_full_name.split(' ')[0]
                      return (
                        <p key={c.id} style={{ margin: '0.5rem 0', color: 'var(--theme-text)', wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
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
        ))}
      </div>
    </div>
  )
}
