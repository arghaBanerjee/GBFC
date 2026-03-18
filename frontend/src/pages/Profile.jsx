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
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

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
                  disabled={submitting}
                  className="nav-btn"
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: '1px solid #10b981',
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
                style={{ 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db'
                }}
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

        {/* Birthday Section */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
            Birthday
          </label>
          {editMode === 'birthday' ? (
            <div>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
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
                  onClick={handleUpdateBirthday}
                  disabled={submitting}
                  className="nav-btn"
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: '1px solid #10b981',
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
                  className="nav-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.125rem', fontWeight: '500', color: user.birthday ? '#000' : '#9ca3af', fontStyle: user.birthday ? 'normal' : 'italic' }}>
                {user.birthday ? formatDate(user.birthday) : 'Not Set'}
              </span>
              <button
                onClick={() => setEditMode('birthday')}
                className="nav-btn"
                style={{ 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db'
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Bank Details Section */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
            Bank Details
          </label>
          {editMode === 'bank-details' ? (
            <div>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Bank name"
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
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={sortCode}
                  onChange={(e) => setSortCode(formatSortCode(e.target.value))}
                  placeholder="Sort code"
                  inputMode="numeric"
                  style={{
                    flex: '1 1 180px',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Account number"
                  inputMode="numeric"
                  style={{
                    flex: '1 1 180px',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <p style={{ marginBottom: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                All three fields are optional, but if you add one, complete all three.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleUpdateBankDetails}
                  disabled={submitting}
                  className="nav-btn"
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: '1px solid #10b981',
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
                  className="nav-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: '500', color: user.bank_name && user.sort_code && user.account_number ? '#000' : '#9ca3af', fontStyle: user.bank_name && user.sort_code && user.account_number ? 'normal' : 'italic' }}>
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
                className="nav-btn"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db',
                  flexShrink: 0,
                }}
              >
                Edit
              </button>
            </div>
          )}
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
                  disabled={submitting}
                  className="nav-btn"
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: '1px solid #10b981',
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
                style={{ 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.875rem',
                  border: '1px solid #d1d5db'
                }}
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
