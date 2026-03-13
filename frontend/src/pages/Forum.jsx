import { useState, useEffect, useMemo, useRef } from 'react'
import { apiUrl } from '../api'

export default function Forum({ user }) {
  const [posts, setPosts] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [newContent, setNewContent] = useState('')
  const editorRef = useRef(null)
  const [commentingPostId, setCommentingPostId] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [myLikedPostIds, setMyLikedPostIds] = useState(new Set())
  const [likesHover, setLikesHover] = useState(null)
  const token = localStorage.getItem('token')

  const pastelColors = useMemo(
    () => [
      '#FDE2E4',
      '#E2F0CB',
      '#CDE7F0',
      '#FFF1CC',
      '#E7D7FF',
      '#D7F9F1',
      '#FFE0B5',
      '#E0ECFF',
    ],
    []
  )

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

  const handleCreate = async () => {
    if (!user) return alert('Please log in to post')
    await fetch(apiUrl('/api/forum'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: newContent }),
    })
    setNewContent('')
    if (editorRef.current) editorRef.current.innerHTML = ''
    setShowCreate(false)
    const updated = await fetch(apiUrl('/api/forum'))
    setPosts(await updated.json())
  }

  const exec = (command, value) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false, value)
    setNewContent(editorRef.current.innerHTML)
  }

  const handleAttachImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!user) return alert('Please log in to attach images')

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
    exec('insertImage', data.image_url)

    e.target.value = ''
  }

  const handleAddLink = () => {
    const url = prompt('Enter URL')
    if (!url) return
    exec('createLink', url)
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

  return (
    <div className="container">
      <style>{`
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
      `}</style>
      <h2>Club Forum</h2>
      {user && (
        <button className="nav-btn active" onClick={() => setShowCreate(true)} style={{ marginBottom: '1rem' }}>
          Create Post
        </button>
      )}
      {showCreate && (
        <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <button className="nav-btn" type="button" onClick={() => exec('bold')}>Bold</button>
            <button className="nav-btn" type="button" onClick={() => exec('italic')}>Italic</button>
            <button className="nav-btn" type="button" onClick={() => exec('underline')}>Underline</button>
            <button className="nav-btn" type="button" onClick={() => exec('insertUnorderedList')}>List</button>
            <button className="nav-btn" type="button" onClick={handleAddLink}>Link</button>
            <label className="nav-btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
              Attach Image
              <input type="file" accept="image/*" onChange={handleAttachImage} style={{ display: 'none' }} />
            </label>
          </div>
          <div
            ref={editorRef}
            contentEditable
            onInput={() => setNewContent(editorRef.current?.innerHTML || '')}
            style={{
              width: '100%',
              minHeight: '120px',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              padding: '0.75rem',
              background: 'white',
              outline: 'none',
            }}
          />
          {!newContent && (
            <div style={{ marginTop: '0.5rem', opacity: 0.7 }}>
              What's on your mind?
            </div>
          )}
          <button className="nav-btn" onClick={handleCreate} style={{ marginRight: '0.5rem' }}>Post</button>
          <button className="nav-btn" onClick={() => setShowCreate(false)}>Cancel</button>
        </div>
      )}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {posts.map((post) => (
          <div
            key={post.id}
            style={{
              background: pastelColors[post.id % pastelColors.length],
              padding: '1rem',
              borderRadius: '0.75rem',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <p><strong>{post.user_full_name}</strong> · {new Date(post.created_at).toLocaleString()}</p>
            <div className="forum-post-content" dangerouslySetInnerHTML={{ __html: post.content }} />
            <div style={{ marginTop: '0.5rem', position: 'relative' }}>
              <button
                className={`nav-btn ${myLikedPostIds.has(post.id) ? 'active' : ''}`}
                onClick={() => handleLikeToggle(post.id)}
                style={{ marginRight: '0.5rem' }}
                onMouseEnter={() => setLikesHover(post.id)}
                onMouseLeave={() => setLikesHover(null)}
              >
                {myLikedPostIds.has(post.id) ? '❤️' : '🤍'} Like ({post.likes_count})
              </button>
              <button className="nav-btn" onClick={() => setCommentingPostId(commentingPostId === post.id ? null : post.id)}>
                Comment ({post.comments.length})
              </button>
              {/* Hover tooltip for likes */}
              {likesHover === post.id && post.likes && post.likes.length > 0 && (
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
                  {post.likes.map((l, idx) => (
                    <div key={idx}>{l.full_name || l.user_email}</div>
                  ))}
                </div>
              )}
            </div>

            {(commentingPostId === post.id || post.comments.length > 0) && (
              <div style={{ marginTop: '1rem', border: '1px solid #d1d5db', padding: '1rem', borderRadius: '0.5rem', background: '#f9fafb' }}>
                {commentingPostId === post.id && (
                  <>
                    <textarea
                      rows={3}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', marginBottom: '0.5rem' }}
                    />
                    <div>
                      <button className="nav-btn" onClick={handleComment} style={{ marginRight: '0.5rem' }}>Post</button>
                      <button className="nav-btn" onClick={() => { setCommentingPostId(null); setCommentText('') }}>Cancel</button>
                    </div>
                  </>
                )}

                {post.comments.length > 0 && (
                  <div style={{ 
                    marginTop: commentingPostId === post.id ? '1rem' : '0',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    paddingRight: '0.5rem'
                  }}>
                    {[...post.comments].reverse().map((c) => {
                      const firstName = c.user_full_name.split(' ')[0]
                      return (
                        <p key={c.id} style={{ margin: '0.5rem 0' }}>
                          <small><strong>{firstName}:</strong> {c.comment}</small>
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
