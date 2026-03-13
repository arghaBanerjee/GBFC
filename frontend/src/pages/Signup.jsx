import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../api'

export default function Signup({ setUser }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
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
      <h2>Sign up</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Full name"
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
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.25rem', borderRadius: '0.375rem', border: validationErrors.fullName ? '1px solid #ef4444' : '1px solid #d1d5db', boxSizing: 'border-box' }}
        />
        {validationErrors.fullName && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0', marginBottom: '0.5rem' }}>{validationErrors.fullName}</p>}
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
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.25rem', borderRadius: '0.375rem', border: validationErrors.email ? '1px solid #ef4444' : '1px solid #d1d5db', boxSizing: 'border-box' }}
        />
        {validationErrors.email && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0', marginBottom: '0.5rem' }}>{validationErrors.email}</p>}
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
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.25rem', borderRadius: '0.375rem', border: validationErrors.password ? '1px solid #ef4444' : '1px solid #d1d5db', boxSizing: 'border-box' }}
        />
        {validationErrors.password && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0', marginBottom: '0.5rem' }}>{validationErrors.password}</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" className="nav-btn" style={{ width: '100%', background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: '600' }}>Create account</button>
      </form>
    </div>
  )
}
