import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../api'

export default function Signup({ setUser }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  const navigate = useNavigate()

  const validateFullName = (name) => {
    if (name.length < 2) return 'Full name must be at least 2 characters'
    if (name.length > 100) return 'Full name must be less than 100 characters'
    if (!/^[a-zA-Z\s'-]+$/.test(name)) return 'Full name can only contain letters, spaces, hyphens, and apostrophes'
    return ''
  }

  const validateEmail = (email) => {
    if (!email) return 'Email is required'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Please enter a valid email address'
    if (email.length > 255) return 'Email must be less than 255 characters'
    return ''
  }

  const validatePassword = (password) => {
    if (password.length < 6) return 'Password must be at least 6 characters'
    if (password.length > 128) return 'Password must be less than 128 characters'
    if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter'
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
    return ''
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate all fields
    const errors = {}
    const nameError = validateFullName(fullName)
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    
    if (nameError) errors.fullName = nameError
    if (emailError) errors.email = emailError
    if (passwordError) errors.password = passwordError
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    
    setValidationErrors({})
    setError('')
    const res = await fetch(apiUrl('/api/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: fullName, password }),
    })
    if (res.ok) {
      // Auto-login after signup
      const form = new FormData()
      form.append('username', email)
      form.append('password', password)
      const tokenRes = await fetch(apiUrl('/api/token'), { method: 'POST', body: form })
      if (tokenRes.ok) {
        const { access_token } = await tokenRes.json()
        localStorage.setItem('token', access_token)
        localStorage.setItem('lastActivity', Date.now().toString())
        const userRes = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${access_token}` } })
        const userData = await userRes.json()
        setUser(userData)
        navigate('/')
      }
    } else {
      const err = await res.json()
      setError(err.detail || 'Signup failed')
    }
  }

  return (
    <div className="container" style={{ maxWidth: '350px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="theme-card" style={{ padding: '1.5rem' }}>
        <h2 className="theme-section-title" style={{ marginTop: 0, marginBottom: '1.5rem' }}>Sign up</h2>
        <form onSubmit={handleSubmit}>
        <div className="auth-input-wrap">
          <svg className="auth-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value)
              if (validationErrors.fullName) {
                const error = validateFullName(e.target.value)
                setValidationErrors(prev => ({ ...prev, fullName: error }))
              }
            }}
            onBlur={(e) => {
              const error = validateFullName(e.target.value)
              if (error) setValidationErrors(prev => ({ ...prev, fullName: error }))
            }}
            required
            className="theme-input"
            style={{ border: validationErrors.fullName ? '1px solid var(--theme-danger)' : undefined }}
          />
        </div>
        {validationErrors.fullName && <p style={{ color: 'var(--theme-danger)', fontSize: '0.875rem', marginTop: '0', marginBottom: '0.5rem' }}>{validationErrors.fullName}</p>}
        <div className="auth-input-wrap">
          <svg className="auth-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (validationErrors.email) {
                const error = validateEmail(e.target.value)
                setValidationErrors(prev => ({ ...prev, email: error }))
              }
            }}
            onBlur={(e) => {
              const error = validateEmail(e.target.value)
              if (error) setValidationErrors(prev => ({ ...prev, email: error }))
            }}
            required
            className="theme-input"
            style={{ border: validationErrors.email ? '1px solid var(--theme-danger)' : undefined }}
          />
        </div>
        {validationErrors.email && <p style={{ color: 'var(--theme-danger)', fontSize: '0.875rem', marginTop: '0', marginBottom: '0.5rem' }}>{validationErrors.email}</p>}
        <div className="auth-input-wrap">
          <svg className="auth-input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => {
              const nextPassword = e.target.value
              setPassword(nextPassword)
              if (validationErrors.password) {
                const error = validatePassword(nextPassword)
                setValidationErrors(prev => ({ ...prev, password: error }))
              }
            }}
            onBlur={(e) => {
              const error = validatePassword(e.target.value)
              if (error) setValidationErrors(prev => ({ ...prev, password: error }))
            }}
            required
            className="theme-input"
            style={{ border: validationErrors.password ? '1px solid var(--theme-danger)' : undefined, paddingRight: '2.75rem' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: '0.25rem', cursor: 'pointer', color: 'var(--theme-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        {validationErrors.password && <p style={{ color: 'var(--theme-danger)', fontSize: '0.875rem', marginTop: '0', marginBottom: '0.5rem' }}>{validationErrors.password}</p>}
        {error && <p style={{ color: 'var(--theme-danger)' }}>{error}</p>}
        <button type="submit" className="nav-btn theme-primary-btn" style={{ width: '100%', fontWeight: '600' }}>
          Create Account
        </button>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="nav-btn theme-secondary-btn"
          style={{ width: '100%', fontWeight: '400', marginTop: '0.5rem' }}
        >
          Already User ? Login
        </button>
        </form>
      </div>
    </div>
  )
}
