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
import { apiUrl } from './api'
import './index.css'

function App() {
  const [user, setUser] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetch(apiUrl('/api/me'), {
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

  const navItems = ['Home', 'Matches', 'Book Practice', 'Club Forum']
  const isActive = (path) => location.pathname === path

  // Simple admin check (email-based)
  const isAdmin = user && user.email === 'admin@example.com'

  return (
    <div>
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-container">
          {/* Logo and Social Icons */}
          <div className="logo">
            <Link to="/" className="logo-link">
              <span className="logo-icon">⚽</span>
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
                  <button className={`nav-btn ${isActive(path) ? 'active' : ''}`}>
                    {item}
                  </button>
                </Link>
              )
            })}
            {isAdmin && (
              <Link to="/admin" className="nav-link">
                <button className={`nav-btn ${isActive('/admin') ? 'active' : ''}`}>Admin</button>
              </Link>
            )}
          </div>

          {/* Desktop Auth Section */}
          <div className="desktop-auth">
            {user ? (
              <>
                <span className="user-name">{user.full_name}</span>
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
                    <button className={`nav-btn ${isActive(path) ? 'active' : ''}`}>
                      {item}
                    </button>
                  </Link>
                )
              })}
              {isAdmin && (
                <Link 
                  to="/admin" 
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <button className={`nav-btn ${isActive('/admin') ? 'active' : ''}`}>Admin</button>
                </Link>
              )}
            </div>
            <div className="mobile-auth">
              {user ? (
                <>
                  <div className="mobile-user-info">
                    <span className="user-name" style={{ textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>{user.full_name}</span>
                  </div>
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
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/matches" element={<Events user={user} />} />
        <Route path="/book-practice" element={<Practice user={user} />} />
        <Route path="/club-forum" element={<Forum user={user} />} />
        <Route path="/about-us" element={<About />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/signup" element={<Signup setUser={setUser} />} />
        <Route path="/admin" element={<Admin user={user} />} />
      </Routes>
    </div>
  )
}

export default App
