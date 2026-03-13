import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../api'

export default function Login({ setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  const navigate = useNavigate()

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
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)

    const res = await fetch(apiUrl('/api/token'), { method: 'POST', body: form })
    if (res.ok) {
      const { access_token } = await res.json()
      localStorage.setItem('token', access_token)
      const userRes = await fetch(apiUrl('/api/me'), { headers: { Authorization: `Bearer ${access_token}` } })
      const userData = await userRes.json()
      setUser(userData)
      navigate('/')
    } else {
      setError('Invalid email or password')
    }
  }

  return (
    <div className="container" style={{ maxWidth: '350px', margin: '2rem auto', padding: '0 1rem' }}>
      <h2>Login</h2>
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
        <button type="submit" className="nav-btn" style={{ width: '100%', background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: '600' }}>Log in</button>
      </form>
    </div>
  )
}
