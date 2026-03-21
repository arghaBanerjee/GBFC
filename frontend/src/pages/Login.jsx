import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiUrl } from '../api'

export default function Login({ setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  
  // ========== FORGOT PASSWORD FEATURE - State Variables ==========
  // These state variables are used by the forgot password feature
  // Keep these even when the button is hidden
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  // ================================================================
  
  const navigate = useNavigate()
  const location = useLocation()

  const validateEmail = (email) => {
    if (!email) return 'Email is required'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Please enter a valid email address'
    return ''
  }

  const validatePassword = (password) => {
    if (!password) return 'Password is required'
    if (password.length < 6) return 'Password must be at least 6 characters'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate all fields
    const errors = {}
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    
    if (emailError) errors.email = emailError
    if (passwordError) errors.password = passwordError
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    
    setValidationErrors({})
    setError('')
    setForgotPasswordMessage('')
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)

    const res = await fetch(apiUrl('/api/token'), { method: 'POST', body: form })
    if (res.ok) {
      const { access_token } = await res.json()
      localStorage.setItem('token', access_token)
      localStorage.setItem('lastActivity', Date.now().toString())
      const userRes = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${access_token}` } })
      const userData = await userRes.json()
      setUser(userData)
      
      // Redirect to the page user was trying to access, or home if none
      const from = location.state?.from || '/'
      navigate(from, { replace: true })
    } else {
      setError('Invalid email or password')
    }
  }

  // ========== FORGOT PASSWORD FEATURE - Handler Function ==========
  // This function handles the forgot password flow:
  // 1. Validates the email address
  // 2. Calls the backend API endpoint /api/forgot-password
  // 3. Displays success/error messages to the user
  // Keep this function even when the button is hidden
  // ================================================================
  const handleForgotPassword = async () => {
    // Validate email first
    const emailError = validateEmail(email)
    if (emailError) {
      setValidationErrors({ email: emailError })
      setForgotPasswordMessage('')
      return
    }
    
    setValidationErrors({})
    setError('')
    setForgotPasswordMessage('')
    setSendingEmail(true)
    
    try {
      const res = await fetch(apiUrl('/api/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      if (res.ok) {
        const data = await res.json()
        setForgotPasswordMessage(data.message || 'If the email is registered, a password reset link has been sent.')
      } else {
        const data = await res.json()
        setForgotPasswordMessage(data.detail || 'Failed to send reset email. Please try again.')
      }
    } catch (err) {
      setForgotPasswordMessage('Failed to send email. Please try again.')
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '350px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="theme-card" style={{ padding: '1.5rem' }}>
        <h2 className="theme-section-title" style={{ marginTop: 0, marginBottom: '1.5rem' }}>Login</h2>
        <form onSubmit={handleSubmit}>
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
          style={{ marginBottom: '0.25rem', border: validationErrors.email ? '1px solid var(--theme-danger)' : undefined }}
        />
        {validationErrors.email && <p style={{ color: 'var(--theme-danger)', fontSize: '0.875rem', marginTop: '0', marginBottom: '0.5rem' }}>{validationErrors.email}</p>}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (validationErrors.password) {
              const error = validatePassword(e.target.value)
              setValidationErrors(prev => ({ ...prev, password: error }))
            }
          }}
          onBlur={(e) => {
            const error = validatePassword(e.target.value)
            if (error) setValidationErrors(prev => ({ ...prev, password: error }))
          }}
          required
          className="theme-input"
          style={{ marginBottom: '0.25rem', border: validationErrors.password ? '1px solid var(--theme-danger)' : undefined }}
        />
        {validationErrors.password && <p style={{ color: 'var(--theme-danger)', fontSize: '0.875rem', marginTop: '0', marginBottom: '0.5rem' }}>{validationErrors.password}</p>}
        {error && <p style={{ color: 'var(--theme-danger)' }}>{error}</p>}
        {/* ========== FORGOT PASSWORD FEATURE - Success/Error Message ========== */}
        {/* This displays feedback when user clicks forgot password button */}
        {forgotPasswordMessage && <p style={{ color: forgotPasswordMessage.toLowerCase().includes('failed') ? 'var(--theme-danger)' : 'var(--theme-accent)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{forgotPasswordMessage}</p>}
        {/* ====================================================================== */}
        
        <button type="submit" className="nav-btn theme-primary-btn" style={{ width: '100%', fontWeight: '600' }}>Log in</button>
        
        {/* Sign Up and Forgot Password buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button 
            type="button" 
            onClick={() => navigate('/signup')}
            className="nav-btn theme-secondary-btn" 
            style={{ 
              flex: 6,
              fontWeight: '400',
              padding: '0.5rem'
            }}
          >
            New User ? Sign Up
          </button>
          <button 
            type="button" 
            onClick={handleForgotPassword}
            disabled={sendingEmail}
            className="nav-btn theme-secondary-btn" 
            style={{ 
              flex: 4,
              fontWeight: '400',
              cursor: sendingEmail ? 'not-allowed' : 'pointer',
              opacity: sendingEmail ? 0.6 : 1,
              padding: '0.5rem'
            }}
          >
            {sendingEmail ? 'Sending...' : 'Forgot Password'}
          </button>
        </div>
        </form>
      </div>
    </div>
  )
}
