import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Events from './pages/Events'
import Practice from './pages/Practice'
import Forum from './pages/Forum'
import About from './pages/About'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Admin from './pages/Admin'
import './index.css'

function App() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (r.ok) return r.json()
          throw new Error()
        })
        .then((u) => setUser(u))
        .catch(() => localStorage.removeItem('token'))
    }
  }, [])

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    navigate('/')
  }

  const navItems = ['Home', 'Events', 'Practice', 'Forum']
  const isActive = (path) => location.pathname === path

  // Simple admin check (email-based)
  const isAdmin = user && user.email === 'admin@example.com'

  return (
    <div>
      {/* Top Navigation */}
      <div className="top-nav">
        <div className="logo">
          <span>⚽ Glasgow Bengali FC</span>
          <div className="social-icons">
            <a
              href="https://www.instagram.com/glasgowbengalifc/"
              target="_blank"
              rel="noreferrer"
              aria-label="Glasgow Bengali FC Instagram"
              title="Instagram"
              className="social-icon"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              aria-label="Glasgow Bengali FC YouTube"
              title="YouTube"
              className="social-icon"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C15.8 4 12 4 12 4h0s-3.8 0-6.7.3c-.4.1-1.3.1-2.1.9-.6.6-.8 2-.8 2S2 8.8 2 10.4v1.5c0 1.6.4 3.2.4 3.2s.2 1.4.8 2c.8.8 1.9.8 2.4.9 1.7.2 6.4.3 6.4.3s3.8 0 6.7-.3c.4-.1 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.4-1.6.4-3.2v-1.5c0-1.6-.4-3.2-.4-3.2Z"
                  fill="currentColor"
                  opacity="0.18"
                />
                <path
                  d="M10 9.5v5l5-2.5-5-2.5Z"
                  fill="currentColor"
                />
                <path
                  d="M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C15.8 4 12 4 12 4h0s-3.8 0-6.7.3c-.4.1-1.3.1-2.1.9-.6.6-.8 2-.8 2S2 8.8 2 10.4v1.5c0 1.6.4 3.2.4 3.2s.2 1.4.8 2c.8.8 1.9.8 2.4.9 1.7.2 6.4.3 6.4.3s3.8 0 6.7-.3c.4-.1 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.4-1.6.4-3.2v-1.5c0-1.6-.4-3.2-.4-3.2Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </a>
          </div>
        </div>
        <div className="menu">
          {navItems.map((item) => {
            const path = item === 'Home' ? '/' : `/${item.toLowerCase().replace(' ', '-')}`
            return (
              <Link key={item} to={path}>
                <button className={`nav-btn ${isActive(path) ? 'active' : ''}`}>
                  {item}
                </button>
              </Link>
            )
          })}
          {isAdmin && (
            <Link to="/admin">
              <button className={`nav-btn ${isActive('/admin') ? 'active' : ''}`}>Admin</button>
            </Link>
          )}
        </div>
        <div className="auth-section">
          {user ? (
            <>
              <span>{user.full_name}</span>
              <button className="nav-btn" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="nav-btn">Login</button>
              </Link>
              <Link to="/signup">
                <button className="nav-btn">Sign up</button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Page Content */}
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/events" element={<Events user={user} />} />
        <Route path="/practice" element={<Practice user={user} />} />
        <Route path="/forum" element={<Forum user={user} />} />
        <Route path="/about-us" element={<About />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/signup" element={<Signup setUser={setUser} />} />
        <Route path="/admin" element={<Admin user={user} />} />
      </Routes>
    </div>
  )
}

export default App
