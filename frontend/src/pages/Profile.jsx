import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../api'

export default function Profile({ user, setUser }) {
  const [editMode, setEditMode] = useState(null) // 'name' or 'password'
  const [fullName, setFullName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/login')
    } else {
      setFullName(user.full_name)
    }
  }, [user, navigate])

  const handleUpdateName = async () => {
    if (!fullName.trim()) {
      setError('Name cannot be empty')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(apiUrl('/api/profile/name'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name: fullName }),
      })

      if (res.ok) {
        const updatedUser = await res.json()
        setUser({ ...user, full_name: updatedUser.full_name })
        setSuccess('Name updated successfully!')
        setEditMode(null)
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to update name')
      }
    } catch (err) {
      setError('Failed to update name. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async () => {
    setError('')
    setSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required')
      return
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(apiUrl('/api/profile/password'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })

      if (res.ok) {
        setSuccess('Password updated successfully!')
        setEditMode(null)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to update password')
      }
    } catch (err) {
      setError('Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!user) return null

  return (
    <div className="container" style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>
      <h2 style={{ marginBottom: '2rem' }}>My Profile</h2>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#fee2e2',
          color: '#dc2626',
          borderRadius: '0.375rem',
          border: '1px solid #fecaca',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#d1fae5',
          color: '#065f46',
          borderRadius: '0.375rem',
          border: '1px solid #a7f3d0',
        }}>
          {success}
        </div>
      )}

      {/* Profile Card */}
      <div style={{
        background: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        {/* Full Name Section */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
            Full Name
          </label>
          {editMode === 'name' ? (
            <div>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '1rem',
                  marginBottom: '0.5rem',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleUpdateName}
                  disabled={loading}
                  className="nav-btn"
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: '1px solid #10b981',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditMode(null)
                    setFullName(user.full_name)
                    setError('')
                  }}
                  className="nav-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.125rem', fontWeight: '500' }}>{user.full_name}</span>
              <button
                onClick={() => setEditMode('name')}
                className="nav-btn"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Email Section (Read-only) */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
            Email Address
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1.125rem', color: '#6b7280' }}>{user.email}</span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>Read-only</span>
          </div>
        </div>

        {/* Password Section */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
            Password
          </label>
          {editMode === 'password' ? (
            <div>
              <input
                type="password"
                placeholder="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '1rem',
                  marginBottom: '0.5rem',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="password"
                placeholder="New Password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '1rem',
                  marginBottom: '0.5rem',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '1rem',
                  marginBottom: '0.5rem',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleUpdatePassword}
                  disabled={loading}
                  className="nav-btn"
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: '1px solid #10b981',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  onClick={() => {
                    setEditMode(null)
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setError('')
                  }}
                  className="nav-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.125rem' }}>••••••••</span>
              <button
                onClick={() => setEditMode('password')}
                className="nav-btn"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Change Password
              </button>
            </div>
          )}
        </div>

        {/* Account Information */}
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>
            Account Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Account Type:</span>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: user.user_type === 'admin' ? '#10b981' : '#374151',
              }}>
                {user.user_type === 'admin' ? 'Admin' : 'Member'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Registered:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                {formatDate(user.created_at)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Last Login:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                {formatDateTime(user.last_login)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
