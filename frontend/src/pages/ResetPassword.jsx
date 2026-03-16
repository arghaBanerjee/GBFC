import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl } from '../api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetCompleted, setResetCompleted] = useState(false)

  const validatePassword = (password) => {
    if (!password) return 'Password is required'
    if (password.length < 6) return 'Password must be at least 6 characters'
    if (password.length > 128) return 'Password must be less than 128 characters'
    if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter'
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!token) {
      setError('Invalid or expired reset link')
      return
    }

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(apiUrl('/api/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage('Password reset successful. You can now log in with your new password.')
        setNewPassword('')
        setConfirmPassword('')
        setResetCompleted(true)
      } else {
        setError(data.detail || 'Failed to reset password')
      }
    } catch (err) {
      setError('Failed to reset password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '350px', margin: '2rem auto', padding: '0 1rem' }}>
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
        />
        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
        />
        {error && <p style={{ color: '#ef4444', marginBottom: '0.5rem' }}>{error}</p>}
        {message && <p style={{ color: '#10b981', marginBottom: '0.5rem' }}>{message}</p>}
        <button type="submit" className="nav-btn" disabled={submitting || resetCompleted} style={{ width: '100%', background: '#10b981', color: 'white', border: '1px solid #10b981', fontWeight: '600', opacity: (submitting || resetCompleted) ? 0.7 : 1, cursor: (submitting || resetCompleted) ? 'not-allowed' : 'pointer' }}>
          {resetCompleted ? 'Password Reset Complete' : submitting ? 'Resetting...' : 'Reset Password'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="nav-btn"
          style={{ width: '100%', background: 'white', color: '#10b981', border: '1px solid #10b981', fontWeight: '400', marginTop: '0.5rem' }}
        >
          Back to Login
        </button>
      </form>
    </div>
  )
}
