import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '../api'

export default function Profile({ user, setUser, loading }) {
  const [editMode, setEditMode] = useState(null) // 'name', 'password', or 'birthday'
  const [fullName, setFullName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [bankName, setBankName] = useState('')
  const [sortCode, setSortCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [themePreference, setThemePreference] = useState('mohun_bagan')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const themeOptions = [
    {
      value: 'east_bengal',
      label: 'East Bengal Theme',
      description: 'Refined yellow and red palette inspired by East Bengal club colours.',
      swatches: ['#bf1e2d', '#f2b705', '#fff8e6'],
    },
    {
      value: 'mohun_bagan',
      label: 'Mohun Bagan Theme',
      description: 'Elegant green and maroon palette inspired by Mohun Bagan club colours.',
      swatches: ['#166534', '#7a1632', '#f5f7f4'],
    },
  ]

  useEffect(() => {
    // Wait for loading to complete before checking authentication
    if (loading) return
    
    if (!user) {
      navigate('/login')
    } else {
      setFullName(user.full_name)
      setBirthday(user.birthday || '')
      setBankName(user.bank_name || '')
      setSortCode(user.sort_code || '')
      setAccountNumber(user.account_number || '')
      setThemePreference(user.theme_preference || 'mohun_bagan')
    }
  }, [user, loading, navigate])

  const formatSortCode = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
  }

  const handleUpdateName = async () => {
    if (!fullName.trim()) {
      setError('Name cannot be empty')
      return
    }

    setSubmitting(true)
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
        
        // Fetch fresh user data from the API to ensure consistency
        const token = localStorage.getItem('token')
        const userRes = await fetch(apiUrl('/api/me'), {
          headers: { Authorization: `Bearer ${token}` },
        })
        
        if (userRes.ok) {
          const freshUserData = await userRes.json()
          
          // Exit edit mode first
          setEditMode(null)
          
          // Then update user state - this will trigger useEffect
          setUser(freshUserData)
          
          // Show success message
          setSuccess('Name updated successfully!')
        } else {
          // Fallback to the returned data if /api/me fails
          setEditMode(null)
          setUser({ ...user, full_name: updatedUser.full_name })
          setSuccess('Name updated successfully!')
        }
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to update name')
      }
    } catch (err) {
      setError('Failed to update name. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateTheme = async () => {
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(apiUrl('/api/profile/theme'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ theme_preference: themePreference }),
      })

      if (res.ok) {
        const data = await res.json()
        setUser({ ...user, theme_preference: data.theme_preference })
        setSuccess('Theme updated successfully!')
        setEditMode(null)
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to update theme')
      }
    } catch (err) {
      setError('Failed to update theme. Please try again.')
    } finally {
      setSubmitting(false)
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

    setSubmitting(true)

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
      setSubmitting(false)
    }
  }

  const handleUpdateBirthday = async () => {
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(apiUrl('/api/profile/birthday'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ birthday }),
      })

      if (res.ok) {
        const data = await res.json()
        setUser({ ...user, birthday: data.birthday })
        setSuccess('Birthday updated successfully!')
        setEditMode(null)
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to update birthday')
      }
    } catch (err) {
      setError('Failed to update birthday. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateBankDetails = async () => {
    const trimmedBankName = bankName.trim()
    const normalizedSortCode = sortCode.replace(/\D/g, '')
    const normalizedAccountNumber = accountNumber.replace(/\D/g, '')
    const hasAnyValue = Boolean(trimmedBankName || normalizedSortCode || normalizedAccountNumber)

    setError('')
    setSuccess('')

    if (trimmedBankName && trimmedBankName.length > 100) {
      setError('Bank name must be 100 characters or less')
      return
    }

    if (hasAnyValue && !trimmedBankName) {
      setError('Bank name is required when adding bank details')
      return
    }

    if (hasAnyValue && normalizedSortCode.length !== 6) {
      setError('Sort code must be 6 digits')
      return
    }

    if (hasAnyValue && (normalizedAccountNumber.length < 6 || normalizedAccountNumber.length > 8)) {
      setError('Account number must be 6 to 8 digits')
      return
    }

    setSubmitting(true)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(apiUrl('/api/profile/bank-details'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bank_name: trimmedBankName,
          sort_code: normalizedSortCode,
          account_number: normalizedAccountNumber,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setUser({
          ...user,
          bank_name: data.bank_name,
          sort_code: data.sort_code,
          account_number: data.account_number,
        })
        setBankName(data.bank_name || '')
        setSortCode(data.sort_code || '')
        setAccountNumber(data.account_number || '')
        setSuccess('Bank details updated successfully!')
        setEditMode(null)
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to update bank details')
      }
    } catch (err) {
      setError('Failed to update bank details. Please try again.')
    } finally {
      setSubmitting(false)
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
      <h2 className="theme-section-title" style={{ marginBottom: '2rem' }}>My Profile</h2>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: 'color-mix(in srgb, var(--theme-danger) 12%, white)',
          color: 'var(--theme-danger)',
          borderRadius: '0.75rem',
          border: '1px solid color-mix(in srgb, var(--theme-danger) 22%, white)',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: 'color-mix(in srgb, var(--theme-accent) 14%, white)',
          color: 'var(--theme-accent-strong)',
          borderRadius: '0.75rem',
          border: '1px solid color-mix(in srgb, var(--theme-accent) 24%, white)',
        }}>
          {success}
        </div>
      )}

      {/* Profile Card */}
      <div className="theme-card" style={{
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        {/* Full Name Section */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--theme-border-soft)' }}>
          <label className="theme-section-title" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Full Name
          </label>
          {editMode === 'name' ? (
            <div>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="theme-input"
                style={{ marginBottom: '0.5rem' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleUpdateName}
                  disabled={submitting}
                  className="nav-btn theme-primary-btn"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditMode(null)
                    setFullName(user.full_name)
                    setError('')
                  }}
                  className="nav-btn theme-secondary-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.125rem', fontWeight: '500', color: 'var(--theme-heading)' }}>{user.full_name}</span>
              <button
                onClick={() => setEditMode('name')}
                className="nav-btn theme-secondary-btn"
                style={{ 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.875rem'
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Email Section (Read-only) */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--theme-border-soft)' }}>
          <label className="theme-section-title" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Email Address
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1.125rem', color: 'var(--theme-text-muted)' }}>{user.email}</span>
            <span className="theme-subtle-text" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>Read-only</span>
          </div>
        </div>

        {/* Theme Section */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--theme-border-soft)' }}>
          <label className="theme-section-title" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Club Theme
          </label>
          {editMode === 'theme' ? (
            <div>
              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }}>
                {themeOptions.map((theme) => {
                  const isSelected = themePreference === theme.value
                  return (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => setThemePreference(theme.value)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '1rem',
                        borderRadius: '0.875rem',
                        border: isSelected ? '2px solid var(--theme-accent)' : '1px solid var(--theme-border)',
                        background: isSelected ? 'var(--theme-surface-alt)' : 'var(--theme-surface)',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 0 4px color-mix(in srgb, var(--theme-accent) 12%, transparent)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--theme-heading)', marginBottom: '0.2rem' }}>{theme.label}</div>
                          <div className="theme-subtle-text" style={{ fontSize: '0.875rem' }}>{theme.description}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          {theme.swatches.map((swatch) => (
                            <span key={swatch} style={{ width: '18px', height: '18px', borderRadius: '999px', background: swatch, border: '1px solid rgba(0,0,0,0.08)' }} />
                          ))}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleUpdateTheme}
                  disabled={submitting}
                  className="nav-btn theme-primary-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? 'Saving...' : 'Save Theme'}
                </button>
                <button
                  onClick={() => {
                    setEditMode(null)
                    setThemePreference(user.theme_preference || 'mohun_bagan')
                    setError('')
                  }}
                  className="nav-btn theme-secondary-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--theme-heading)' }}>
                  {themeOptions.find((theme) => theme.value === (user.theme_preference || 'mohun_bagan'))?.label || 'Mohun Bagan Theme'}
                </div>
                <div className="theme-subtle-text" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  Choose the club-inspired colour palette you want across the app.
                </div>
              </div>
              <button
                onClick={() => setEditMode('theme')}
                className="nav-btn theme-secondary-btn"
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flexShrink: 0 }}
              >
                Change Theme
              </button>
            </div>
          )}
        </div>

        {/* Birthday Section */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--theme-border-soft)' }}>
          <label className="theme-section-title" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Birthday
          </label>
          {editMode === 'birthday' ? (
            <div>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="theme-input"
                style={{ marginBottom: '0.5rem' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleUpdateBirthday}
                  disabled={submitting}
                  className="nav-btn theme-primary-btn"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditMode(null)
                    setBirthday(user.birthday || '')
                    setError('')
                  }}
                  className="nav-btn theme-secondary-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', fontWeight: '500', color: user.birthday ? 'var(--theme-heading)' : 'var(--theme-text-muted)', fontStyle: user.birthday ? 'normal' : 'italic' }}>
                {user.birthday ? formatDate(user.birthday) : 'Not Set'}
              </span>
              <button
                onClick={() => setEditMode('birthday')}
                className="nav-btn theme-secondary-btn"
                style={{ 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.875rem'
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Bank Details Section */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--theme-border-soft)' }}>
          <label className="theme-section-title" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Bank Details
          </label>
          {editMode === 'bank-details' ? (
            <div>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Bank name"
                className="theme-input"
                style={{ marginBottom: '0.5rem' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={sortCode}
                  onChange={(e) => setSortCode(formatSortCode(e.target.value))}
                  placeholder="Sort code"
                  inputMode="numeric"
                  className="theme-input"
                  style={{ flex: '1 1 180px' }}
                />
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Account number"
                  inputMode="numeric"
                  className="theme-input"
                  style={{ flex: '1 1 180px' }}
                />
              </div>
              <p className="theme-subtle-text" style={{ marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                All three fields are optional, but if you add one, complete all three.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleUpdateBankDetails}
                  disabled={submitting}
                  className="nav-btn theme-primary-btn"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditMode(null)
                    setBankName(user.bank_name || '')
                    setSortCode(user.sort_code || '')
                    setAccountNumber(user.account_number || '')
                    setError('')
                  }}
                  className="nav-btn theme-secondary-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: '500', color: user.bank_name && user.sort_code && user.account_number ? 'var(--theme-heading)' : 'var(--theme-text-muted)', fontStyle: user.bank_name && user.sort_code && user.account_number ? 'normal' : 'italic' }}>
                {user.bank_name && user.sort_code && user.account_number ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span>{user.bank_name}</span>
                    <span>Sort Code: {user.sort_code}</span>
                    <span>Account Number: {user.account_number}</span>
                  </div>
                ) : (
                  'Not Set'
                )}
              </div>
              <button
                onClick={() => setEditMode('bank-details')}
                className="nav-btn theme-secondary-btn"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  flexShrink: 0,
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Password Section */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--theme-border-soft)' }}>
          <label className="theme-section-title" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Password
          </label>
          {editMode === 'password' ? (
            <div>
              <input
                type="password"
                placeholder="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="theme-input"
                style={{ marginBottom: '0.5rem' }}
              />
              <input
                type="password"
                placeholder="New Password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="theme-input"
                style={{ marginBottom: '0.5rem' }}
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="theme-input"
                style={{ marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleUpdatePassword}
                  disabled={submitting}
                  className="nav-btn theme-primary-btn"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  onClick={() => {
                    setEditMode(null)
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setError('')
                  }}
                  className="nav-btn theme-secondary-btn"
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
                className="nav-btn theme-secondary-btn"
                style={{ 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.875rem'
                }}
              >
                Change Password
              </button>
            </div>
          )}
        </div>

        {/* Account Information */}
        <div>
          <h3 className="theme-section-title" style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
            Account Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="theme-subtle-text" style={{ fontSize: '0.875rem' }}>Account Type:</span>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: user.user_type === 'admin' ? 'var(--theme-accent)' : 'var(--theme-heading)',
              }}>
                {user.user_type === 'admin' ? 'Admin' : 'Member'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="theme-subtle-text" style={{ fontSize: '0.875rem' }}>Registered:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--theme-heading)' }}>
                {formatDate(user.created_at)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="theme-subtle-text" style={{ fontSize: '0.875rem' }}>Last Login:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--theme-heading)' }}>
                {formatDateTime(user.last_login)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
