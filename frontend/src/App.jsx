import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Events from './pages/Events'
import Practice from './pages/Practice'
import Forum from './pages/Forum'
import About from './pages/About'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'
import Profile from './pages/Profile'
import UserActions from './pages/UserActions'
import ProtectedRoute from './components/ProtectedRoute'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import { apiUrl } from './api'
import clubLogo from './assets/club-logo.jpeg'
import './index.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notificationRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const sessionTimeoutRef = useRef(null)
  const lastActivityRef = useRef(Date.now())

  // Shared function to fetch notifications
  const fetchNotifications = async () => {
    const token = localStorage.getItem('token')
    if (!token || !user) return
    try {
      const res = await fetch(apiUrl('/api/notifications'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.read).length)
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }

  // Session timeout: 48 hours of inactivity
  const SESSION_TIMEOUT = 48 * 60 * 60 * 1000

  const resetSessionTimeout = () => {
    lastActivityRef.current = Date.now()
    localStorage.setItem('lastActivity', Date.now().toString())
  }

  const checkSessionTimeout = () => {
    const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0')
    const now = Date.now()
    if (lastActivity && (now - lastActivity) > SESSION_TIMEOUT) {
      logout(true)
      return true
    }
    return false
  }

  const logout = (isSessionExpired = false) => {
    localStorage.removeItem('token')
    localStorage.removeItem('lastActivity')
    setUser(null)
    if (sessionTimeoutRef.current) {
      clearInterval(sessionTimeoutRef.current)
    }
    if (isSessionExpired) {
      navigate('/login', { replace: true, state: { from: location.pathname + location.search } })
    } else {
      navigate('/login')
    }
  }

  // Track user activity to reset timeout
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      resetSessionTimeout()
    }

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity)
    })

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [])

  // Check session timeout every minute
  useEffect(() => {
    if (user) {
      sessionTimeoutRef.current = setInterval(checkSessionTimeout, 60000)
      return () => {
        if (sessionTimeoutRef.current) {
          clearInterval(sessionTimeoutRef.current)
        }
      }
    }
  }, [user])

  // Fetch user on mount and preserve current route
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      if (checkSessionTimeout()) {
        setLoading(false)
        return
      }
      
      fetch(apiUrl('/api/me'), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (r.ok) return r.json()
          throw new Error()
        })
        .then((u) => {
          setUser(u)
          resetSessionTimeout()
          setLoading(false)
          // User stays on current page - no redirect
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('lastActivity')
          setLoading(false)
          navigate('/login')
        })
    } else {
      setLoading(false)
    }
  }, [])

  // Poll notifications every 5 seconds
  useEffect(() => {
    if (!user) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5000)
    return () => clearInterval(interval)
  }, [user])

  // Refresh notifications when location changes
  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [location.pathname])

  const markAsRead = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      await fetch(apiUrl('/api/notifications/mark-read'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark notifications as read:', err)
    }
  }

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [notificationsOpen])


  const navItems = ['Home', 'Matches', 'Book Practice', 'Forum']
  const isActive = (path) => location.pathname === path
  const isSectionActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  const isUserActionsActive = location.pathname === '/user-actions' || location.pathname.startsWith('/user-actions/')

  // Admin check: user_type is 'admin' OR email is 'super@admin.com'
  const isAdmin = user && (user.user_type === 'admin' || user.email === 'super@admin.com')

  return (
    <div>
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-container">
          {/* Logo and Social Icons */}
          <div className="logo">
            <Link to="/" className="logo-link">
              <img src={clubLogo} alt="Glasgow Bengali FC logo" className="logo-icon" />
              <span className="logo-club-name">GBFC</span>
              <span className="logo-text">Glasgow Bengali FC</span>
            </Link>
            <div className="social-icons">
              <a
                href="https://www.instagram.com/glasgowbengalifc/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="social-icon"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path d="M17.5 6.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@GlasgowBengaliFC"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="social-icon"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C15.8 4 12 4 12 4h0s-3.8 0-6.7.3c-.4.1-1.3.1-2.1.9-.6.6-.8 2-.8 2S2 8.8 2 10.4v1.5c0 1.6.4 3.2.4 3.2s.2 1.4.8 2c.8.8 1.9.8 2.4.9 1.7.2 6.4.3 6.4.3s3.8 0 6.7-.3c.4-.1 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.4-1.6.4-3.2v-1.5c0-1.6-.4-3.2-.4-3.2Z"
                    fill="currentColor"
                    opacity="0.18"
                  />
                  <path d="M10 9.5v5l5-2.5-5-2.5Z" fill="currentColor" />
                  <path
                    d="M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C15.8 4 12 4 12 4h0s-3.8 0-6.7.3c-.4.1-1.3.1-2.1.9-.6.6-.8 2-.8 2S2 8.8 2 10.4v1.5c0 1.6.4 3.2.4 3.2s.2 1.4.8 2c.8.8 1.9.8 2.4.9 1.7.2 6.4.3 6.4.3s3.8 0 6.7-.3c.4-.1 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.4-1.6.4-3.2v-1.5c0-1.6-.4-3.2-.4-3.2Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="desktop-menu">
            {navItems.map((item) => {
              const path = item === 'Home' ? '/' : `/${item.toLowerCase().replace(' ', '-')}`
              return (
                <Link key={item} to={path} className="nav-link">
                  <button className={`nav-btn ${(path === '/matches' ? isSectionActive(path) : isActive(path)) ? 'active' : ''}`}>
                    {item}
                  </button>
                </Link>
              )
            })}
            {isAdmin && (
              <Link to="/admin/practice" className="nav-link">
                <button className={`nav-btn ${isSectionActive('/admin') ? 'active' : ''}`}>Admin</button>
              </Link>
            )}
          </div>

          <div className="nav-actions">
            {/* User Actions Icon - visible on both desktop and mobile */}
            {user && (
              <Link to="/user-actions/events" style={{ textDecoration: 'none' }} title="My Actions">
                <button
                  className="social-icon nav-action-icon"
                  style={{
                    background: isUserActionsActive ? '#16a34a' : '#f3f4f6',
                    color: isUserActionsActive ? 'white' : '#374151',
                    borderColor: isUserActionsActive ? '#16a34a' : '#e5e7eb',
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </button>
              </Link>
            )}

            {/* Notification Bell - visible on both desktop and mobile */}
            {user && (
              <div ref={notificationRef} className="notification-wrapper">
                <button
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen)
                    if (!notificationsOpen && unreadCount > 0) markAsRead()
                  }}
                  className="social-icon nav-action-icon"
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    background: notificationsOpen ? '#16a34a' : '#f3f4f6',
                    color: notificationsOpen ? 'white' : '#374151',
                    borderColor: notificationsOpen ? '#16a34a' : '#e5e7eb',
                  }}
                  aria-label="Notifications"
                >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <path
                          d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M13.73 21a2 2 0 0 1-3.46 0"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {unreadCount > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            background: '#ef4444',
                            color: 'white',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            fontSize: '0.65rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                          }}
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                </button>
                {notificationsOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: '0',
                      marginTop: '0.5rem',
                      background: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      width: window.innerWidth <= 768 ? '85vw' : '320px',
                      maxWidth: '320px',
                      maxHeight: window.innerWidth <= 768 ? '280px' : '400px',
                      overflowY: 'auto',
                      zIndex: 1000,
                    }}
                  >
                    <div style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
                      <strong>Notifications</strong>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid #f0f0f0',
                            background: notif.read ? 'white' : '#f0f9ff',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setNotificationsOpen(false)
                            setMobileMenuOpen(false)
                            if (notif.type === 'forum_post') navigate('/forum')
                            else if (notif.type === 'match') navigate('/matches/upcoming')
                            else if (notif.type === 'practice' || notif.type === 'payment_request' || notif.type === 'payment_confirmed') {
                              if (notif.related_date) {
                                navigate(`/book-practice?date=${notif.related_date}`)
                              } else {
                                navigate('/book-practice')
                              }
                            }
                          }}
                        >
                          <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                            {notif.message}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#999' }}>
                            {new Date(notif.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Desktop Auth Section */}
            <div className="desktop-auth">
              {user ? (
                <>
                  <Link to="/profile" style={{ textDecoration: 'none' }}>
                    <span className="user-name" style={{ cursor: 'pointer', border: '1px solid #10b981', color: '#10b981', backgroundColor: '#f0fdf4', padding: '0.5rem 1rem', borderRadius: '0.375rem' }}>{user.full_name}</span>
                  </Link>
                  <button className="nav-btn logout-btn" onClick={logout}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <button className="nav-btn login-btn">Login</button>
                  </Link>
                  <Link to="/signup">
                    <button className="nav-btn signup-btn">Sign Up</button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="mobile-menu-btn" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="mobile-menu">
            <div className="mobile-nav-items">
              {navItems.map((item) => {
                const path = item === 'Home' ? '/' : `/${item.toLowerCase().replace(' ', '-')}`
                return (
                  <Link 
                    key={item} 
                    to={path} 
                    className="mobile-nav-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <button className={`nav-btn ${(path === '/matches' ? isSectionActive(path) : isActive(path)) ? 'active' : ''}`}>
                      {item}
                    </button>
                  </Link>
                )
              })}
              {isAdmin && (
                <Link 
                  to="/admin/practice" 
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <button className={`nav-btn ${isSectionActive('/admin') ? 'active' : ''}`}>Admin</button>
                </Link>
              )}
            </div>
            <div className="mobile-auth">
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                    <span className="user-name mobile-profile-link" style={{ textAlign: 'center', display: 'block', cursor: 'pointer', border: '1px solid #10b981', color: '#10b981', backgroundColor: '#f0fdf4', padding: '0.75rem 1rem', borderRadius: '0.5rem' }}>{user.full_name}</span>
                  </Link>
                  <button className="nav-btn logout-btn" onClick={() => { logout(); setMobileMenuOpen(false); }}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <button className="nav-btn login-btn">Login</button>
                  </Link>
                  <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <button className="nav-btn signup-btn">Sign Up</button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <RouteErrorBoundary>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/signup" element={<Signup setUser={setUser} />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/about-us" element={<About />} />
          
          {/* Protected routes - require authentication */}
          <Route path="/" element={
            <ProtectedRoute user={user} loading={loading}>
              <Home user={user} />
            </ProtectedRoute>
          } />
          <Route path="/matches" element={<Navigate to="/matches/upcoming" replace />} />
          <Route path="/matches/upcoming" element={
            <ProtectedRoute user={user} loading={loading}>
              <Events user={user} />
            </ProtectedRoute>
          } />
          <Route path="/matches/past" element={
            <ProtectedRoute user={user} loading={loading}>
              <Events user={user} />
            </ProtectedRoute>
          } />
          <Route path="/book-practice" element={
            <ProtectedRoute user={user} loading={loading}>
              <Practice user={user} />
            </ProtectedRoute>
          } />
          <Route path="/forum" element={
            <ProtectedRoute user={user} loading={loading}>
              <Forum user={user} />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute user={user} loading={loading}>
              <Profile user={user} setUser={setUser} loading={loading} />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={<Navigate to="/admin/practice" replace />} />
          <Route path="/admin/:tab" element={
            <ProtectedRoute user={user} loading={loading}>
              <Admin user={user} loading={loading} />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute user={user} loading={loading}>
              <Navigate to="/admin/reports" replace />
            </ProtectedRoute>
          } />
          <Route path="/user-actions" element={<Navigate to="/user-actions/events" replace />} />
          <Route path="/user-actions/upcoming" element={<Navigate to="/user-actions/events" replace />} />
          <Route path="/user-actions/events" element={
            <ProtectedRoute user={user} loading={loading}>
              <UserActions user={user} loading={loading} />
            </ProtectedRoute>
          } />
          <Route path="/user-actions/upcoming-events" element={<Navigate to="/user-actions/events" replace />} />
          <Route path="/user-actions/payments" element={
            <ProtectedRoute user={user} loading={loading}>
              <UserActions user={user} loading={loading} />
            </ProtectedRoute>
          } />
          <Route path="/user-actions/pending-payments" element={<Navigate to="/user-actions/payments" replace />} />
        </Routes>
      </RouteErrorBoundary>
    </div>
  )
}

export default App
