import { useState, useRef, useEffect } from 'react'
import { apiUrl } from '../api'

export default function CalendarAdmin({ 
  selectedSession, 
  user, 
  token, 
  onSessionUpdate,
  onPaymentRequest,
  onRefreshData 
}) {
  // Admin state
  const adminControlsRef = useRef(null)
  const [adminControlsOpen, setAdminControlsOpen] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  
  // Payment information state
  const [calendarEventCost, setCalendarEventCost] = useState('')
  const [calendarEventCostType, setCalendarEventCostType] = useState('Total')
  const [paidBy, setPaidBy] = useState('')
  const [paymentInfoSaved, setPaymentInfoSaved] = useState(false)
  
  // Track original values to detect changes
  const [originalPaymentData, setOriginalPaymentData] = useState({
    cost: '',
    costType: 'Total',
    paidBy: ''
  })
  const [hasPaymentChanges, setHasPaymentChanges] = useState(false)
  
  // Availability state
  const [selectedUserEmail, setSelectedUserEmail] = useState('')
  const [adminSelectedStatus, setAdminSelectedStatus] = useState('available')
  const [adminAvailabilityUpdating, setAdminAvailabilityUpdating] = useState(false)
  const [adminAvailabilityError, setAdminAvailabilityError] = useState('')
  
  // Payment request state
  const [paymentRequestPending, setPaymentRequestPending] = useState(false)
  const [paymentUpdatePending, setPaymentUpdatePending] = useState(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)

  // Check if user is admin
  const isAdmin = user?.user_type === 'admin'

  // Initialize state when session changes
  useEffect(() => {
    if (selectedSession) {
      const cost = selectedSession.session_cost != null ? selectedSession.session_cost.toString() : ''
      const costType = selectedSession.cost_type || 'Total'
      const paidByValue = selectedSession.paid_by || ''
      
      // Only update state if the values are different from current local values
      // This prevents overwriting values that were just saved
      if (calendarEventCost !== cost || calendarEventCostType !== costType || paidBy !== paidByValue) {
        setCalendarEventCost(cost)
        setCalendarEventCostType(costType)
        setPaidBy(paidByValue)
        setPaymentInfoSaved(Boolean(selectedSession.session_cost != null && selectedSession.paid_by))
        
        // Set original values for change detection
        setOriginalPaymentData({
          cost,
          costType,
          paidBy: paidByValue
        })
        setHasPaymentChanges(false)
      }
    } else {
      setCalendarEventCost('')
      setCalendarEventCostType('Total')
      setPaidBy('')
      setPaymentInfoSaved(false)
      setOriginalPaymentData({
        cost: '',
        costType: 'Total',
        paidBy: ''
      })
      setHasPaymentChanges(false)
    }
  }, [selectedSession])

  // Detect changes in payment fields
  useEffect(() => {
    const hasChanges = (
      calendarEventCost !== originalPaymentData.cost ||
      calendarEventCostType !== originalPaymentData.costType ||
      paidBy !== originalPaymentData.paidBy
    )
    setHasPaymentChanges(hasChanges)
  }, [calendarEventCost, calendarEventCostType, paidBy, originalPaymentData])

  // Load users when admin controls are opened
  useEffect(() => {
    if (!isAdmin || !adminControlsOpen || !token || allUsers.length > 0 || adminUsersLoading) return

    setAdminUsersLoading(true)
    fetch(apiUrl('/api/users'), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(r => r.json())
      .then(data => setAllUsers(data || []))
      .catch(() => setAllUsers([]))
      .finally(() => setAdminUsersLoading(false))
  }, [isAdmin, adminControlsOpen, token, allUsers.length, adminUsersLoading])

  const handleToggleAdminControls = () => {
    // Scroll to the admin controls container
    adminControlsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Toggle the admin controls open/closed state
    setAdminControlsOpen((prev) => !prev)
  }

  const handleSavePaymentInfo = () => {
    if (!selectedSession) return
    
    fetch(apiUrl(`/api/calendar/events/id/${selectedSession.id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: selectedSession.date,
        time: selectedSession.time,
        location: selectedSession.location,
        event_type: selectedSession.event_type,
        event_title: selectedSession.event_title,
        description: selectedSession.description,
        image_url: selectedSession.image_url,
        youtube_url: selectedSession.youtube_url,
        option_a_text: selectedSession.option_a_text,
        option_b_text: selectedSession.option_b_text,
        session_cost: calendarEventCost ? parseFloat(calendarEventCost) : null,
        paid_by: paidBy || null,
        cost_type: calendarEventCostType,
      }),
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to save payment info')
          })
        }
        return r.json()
      })
      .then((updatedSession) => {
        setPaymentInfoSaved(true)
        // Update original values to reset change tracking
        setOriginalPaymentData({
          cost: calendarEventCost,
          costType: calendarEventCostType,
          paidBy: paidBy
        })
        setHasPaymentChanges(false)
        
        // Update the parent with the new session data
        onSessionUpdate(updatedSession)
        
        // Refresh with the updated session data to prevent old values from overwriting
        onRefreshData(updatedSession)
      })
      .catch(err => {
        console.error('Failed to save payment info:', err)
        alert(`Failed to save payment info: ${err.message}`)
      })
  }

  const handleRequestPayment = () => {
    if (!selectedSession) return
    
    setPaymentRequestPending(true)
    fetch(apiUrl(`/api/calendar/events/id/${selectedSession.id}/request-payment`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to request payment')
          })
        }
        return r.json()
      })
      .then(() => {
        onPaymentRequest()
        onRefreshData(selectedSession)
      })
      .catch(err => console.error('Failed to request payment:', err))
      .finally(() => setPaymentRequestPending(false))
  }

  const handleAdminSetAvailability = () => {
    if (!selectedUserEmail || adminAvailabilityUpdating || !selectedSession) {
      return
    }
    setAdminAvailabilityError('')
    setAdminAvailabilityUpdating(true)
    
    fetch(apiUrl(`/api/admin/calendar/events/id/${selectedSession.id}/availability`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_email: selectedUserEmail,
        status: adminSelectedStatus,
      }),
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to set availability')
          })
        }
        return r.json()
      })
      .then(() => {
        setSelectedUserEmail('')
        setAdminSelectedStatus('available')
        onRefreshData(selectedSession, { refreshAvailabilityMap: true })
      })
      .catch(err => {
        setAdminAvailabilityError(err.message || 'Failed to set availability')
        console.error('Failed to set availability:', err)
      })
      .finally(() => setAdminAvailabilityUpdating(false))
  }

  const handleAdminDeleteAvailability = (userEmail) => {
    if (!selectedSession) return
    if (!confirm('Are you sure you want to remove this user\'s availability?')) {
      return
    }
    setAdminAvailabilityError('')
    setAdminAvailabilityUpdating(true)
    
    fetch(apiUrl(`/api/admin/calendar/events/id/${selectedSession.id}/availability`), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_email: userEmail,
      }),
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => {
            throw new Error(err.detail || 'Failed to delete availability')
          })
        }
        return r.json()
      })
      .then(() => {
        onRefreshData(selectedSession, { refreshAvailabilityMap: userEmail === user?.email })
      })
      .catch(err => {
        setAdminAvailabilityError(err.message || 'Failed to delete availability')
      })
      .finally(() => setAdminAvailabilityUpdating(false))
  }

  const selectedPaidByUser = allUsers.find((u) => u.email === paidBy)
  const paidByBankDetails = selectedSession?.payment_requested
    ? {
        full_name: selectedSession?.paid_by_name || selectedSession?.paid_by,
        bank_name: selectedSession?.paid_by_bank_name,
        sort_code: selectedSession?.paid_by_sort_code,
        account_number: selectedSession?.paid_by_account_number,
      }
    : selectedPaidByUser
    ? {
        full_name: selectedPaidByUser.full_name,
        bank_name: selectedPaidByUser.bank_name,
        sort_code: selectedPaidByUser.sort_code,
        account_number: selectedPaidByUser.account_number,
      }
    : null

  const hasPaidByBankDetails = Boolean(paidByBankDetails?.bank_name && paidByBankDetails?.sort_code && paidByBankDetails?.account_number)
  const hasAmount = Boolean(calendarEventCost && calendarEventCost.trim() !== '' && calendarEventCost !== '0' && calendarEventCost !== '0.00')
  const canSavePaymentInfo = Boolean(hasAmount && paidBy)

  if (!isAdmin) {
    return null
  }

  return (
    <div ref={adminControlsRef} style={{ marginTop: '1rem', background: 'color-mix(in srgb, var(--theme-danger) 8%, var(--theme-surface))', borderRadius: '0.75rem', border: '1px solid color-mix(in srgb, var(--theme-danger) 24%, white)', overflow: 'hidden', boxShadow: adminControlsOpen ? 'var(--theme-card-shadow)' : 'none', transition: 'all 0.25s ease' }}>
      <button
        type="button"
        onClick={handleToggleAdminControls}
        style={{
          width: '100%',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: adminControlsOpen ? 'color-mix(in srgb, var(--theme-danger) 12%, white)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.25s ease',
        }}
      >
        <strong style={{ color: 'var(--theme-danger-strong)' }}>Admin Controls</strong>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--theme-danger-strong)', fontSize: '0.875rem', fontWeight: '600' }}>
          {adminControlsOpen ? 'Hide' : 'Show'}
          <span style={{ display: 'inline-block', transform: adminControlsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}>▼</span>
        </span>
      </button>

      <div style={{ maxHeight: adminControlsOpen ? '1200px' : '0', opacity: adminControlsOpen ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease, opacity 0.25s ease' }}>
        <div style={{ padding: adminControlsOpen ? '0 1rem 1rem 1rem' : '0 1rem', transform: adminControlsOpen ? 'translateY(0)' : 'translateY(-8px)', transition: 'padding 0.25s ease, transform 0.25s ease' }}>
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--theme-surface)', borderRadius: '0.5rem', border: '1px solid var(--theme-border)' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--theme-heading)' }}>Payment Information</div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--theme-text)' }}>
                  <input
                    type="radio"
                    name="costType"
                    value="Total"
                    checked={calendarEventCostType === 'Total'}
                    onChange={(e) => {
                      setCalendarEventCostType(e.target.value)
                      setPaymentInfoSaved(false)
                    }}
                    disabled={selectedSession?.payment_requested}
                    style={{ cursor: selectedSession?.payment_requested ? 'not-allowed' : 'pointer' }}
                  />
                  Total Event Cost
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--theme-text)' }}>
                  <input
                    type="radio"
                    name="costType"
                    value="Individual"
                    checked={calendarEventCostType === 'Individual'}
                    onChange={(e) => {
                      setCalendarEventCostType(e.target.value)
                      setPaymentInfoSaved(false)
                    }}
                    disabled={selectedSession?.payment_requested}
                    style={{ cursor: selectedSession?.payment_requested ? 'not-allowed' : 'pointer' }}
                  />
                  Per Person Cost
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ flex: '0 0 100px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--theme-text-muted)', marginBottom: '0.25rem' }}>Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={calendarEventCost}
                  onChange={(e) => {
                    const value = e.target.value
                    // Only allow numbers, decimal point, and up to 2 decimal places
                    // Explicitly block 'e', 'E', '+', '-' to prevent scientific notation
                    const validNumber = /^[0-9]*\.?[0-9]{0,2}$/
                    if (value === '' || validNumber.test(value)) {
                      setCalendarEventCost(value)
                      setPaymentInfoSaved(false)
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent 'e', 'E', '+', '-' keys from being entered
                    if (['e', 'E', '+', '-'].includes(e.key)) {
                      e.preventDefault()
                    }
                  }}
                  placeholder="0.00"
                  disabled={selectedSession?.payment_requested}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', fontSize: '0.875rem', opacity: selectedSession?.payment_requested ? 0.6 : 1, cursor: selectedSession?.payment_requested ? 'not-allowed' : 'text' }}
                />
              </div>
              <div style={{ flex: '1' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--theme-text-muted)', marginBottom: '0.25rem' }}>Paid By</label>
                {selectedSession?.payment_requested ? (
                  <input
                    type="text"
                    value={selectedSession.paid_by_name || selectedSession.paid_by || 'Not set'}
                    disabled
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', fontSize: '0.875rem', opacity: 0.6, cursor: 'not-allowed' }}
                  />
                ) : (
                  <select
                    value={paidBy}
                    onChange={(e) => {
                      setPaidBy(e.target.value)
                      setPaymentInfoSaved(false)
                    }}
                    disabled={selectedSession?.payment_requested}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', fontSize: '0.875rem', opacity: selectedSession?.payment_requested ? 0.6 : 1, cursor: selectedSession?.payment_requested ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="">Select user...</option>
                    {allUsers.map((u) => (
                      <option key={u.email} value={u.email}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {!selectedSession?.payment_requested && paidBy && !hasPaidByBankDetails && !adminUsersLoading && (
              <div style={{ marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--theme-warning-strong)', background: 'var(--theme-warning-soft)', border: '1px solid color-mix(in srgb, var(--theme-warning) 28%, white)', borderRadius: '0.375rem', padding: '0.625rem 0.75rem' }}>
                Bank Details not available for the user
              </div>
            )}
            {adminUsersLoading && <div style={{ marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--theme-text-muted)' }}>Loading users...</div>}
            {hasPaidByBankDetails && (
              <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--theme-surface-alt)', borderRadius: '0.375rem', border: '1px solid var(--theme-border)' }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--theme-heading)' }}>Bank Details</div>
                <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--theme-text)' }}>
                  <div><strong>Account Holder:</strong> {paidByBankDetails.full_name || 'Unknown User'}</div>
                  <div><strong>Bank Name:</strong> {paidByBankDetails.bank_name}</div>
                  <div><strong>Sort Code:</strong> {paidByBankDetails.sort_code}</div>
                  <div><strong>Account Number:</strong> {paidByBankDetails.account_number}</div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              {/* Save Payment Info Button - Always visible */}
              <button
                onClick={handleSavePaymentInfo}
                disabled={!hasPaymentChanges || selectedSession?.payment_requested}
                style={{ 
                  padding: '0.5rem 1rem', 
                  borderRadius: '0.375rem', 
                  background: (!hasPaymentChanges || selectedSession?.payment_requested) ? 'var(--theme-border)' : 'var(--theme-accent)', 
                  color: (!hasPaymentChanges || selectedSession?.payment_requested) ? 'var(--theme-text-muted)' : 'var(--theme-accent-contrast)', 
                  border: 'none', 
                  cursor: (!hasPaymentChanges || selectedSession?.payment_requested) ? 'not-allowed' : 'pointer', 
                  fontWeight: '600', 
                  fontSize: '0.875rem', 
                  transition: 'all 0.2s' 
                }}
              >
                Save Payment Info
              </button>
              
              {/* Request Payment Button - Always visible */}
              <button
                onClick={handleRequestPayment}
                disabled={!canSavePaymentInfo || !selectedSession?.has_passed || selectedSession?.payment_requested || paymentRequestPending}
                style={{ 
                  padding: '0.5rem 1rem', 
                  borderRadius: '0.375rem', 
                  background: (!canSavePaymentInfo || !selectedSession?.has_passed || selectedSession?.payment_requested || paymentRequestPending) ? 'var(--theme-border)' : 'var(--theme-accent)', 
                  color: (!canSavePaymentInfo || !selectedSession?.has_passed || selectedSession?.payment_requested || paymentRequestPending) ? 'var(--theme-text-muted)' : 'var(--theme-accent-contrast)', 
                  border: 'none', 
                  cursor: (!canSavePaymentInfo || !selectedSession?.has_passed || selectedSession?.payment_requested || paymentRequestPending) ? 'not-allowed' : 'pointer', 
                  fontWeight: '600', 
                  fontSize: '0.875rem', 
                  transition: 'all 0.2s' 
                }}
              >
                {selectedSession?.payment_requested ? 'Payment Requested' : !selectedSession?.has_passed ? 'Request Payment After Event' : !canSavePaymentInfo ? 'Save payment info first' : 'Request Payment'}
              </button>
            </div>
          </div>

        {/* Admin Availability Controls */}
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--theme-surface)', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', opacity: (selectedSession?.payment_requested && selectedSession?.cost_type !== 'Individual') ? 0.6 : 1, pointerEvents: (selectedSession?.payment_requested && selectedSession?.cost_type !== 'Individual') ? 'none' : 'auto' }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--theme-heading)' }}>Set Member Availability</div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 140px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--theme-text-muted)', marginBottom: '0.25rem' }}>Availability</label>
              <select 
                value={adminSelectedStatus} 
                onChange={(e) => setAdminSelectedStatus(e.target.value)} 
                disabled={(selectedSession?.payment_requested && selectedSession?.cost_type !== 'Individual') || adminAvailabilityUpdating} 
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', fontSize: '0.875rem' }}
              >
                <option value="available">Available</option>
                <option value="tentative">Tentative</option>
                <option value="not_available">Unavailable</option>
              </select>
            </div>
            <div style={{ flex: '1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--theme-text-muted)', marginBottom: '0.25rem' }}>Select Member</label>
              <select 
                value={selectedUserEmail} 
                onChange={(e) => setSelectedUserEmail(e.target.value)} 
                disabled={(selectedSession?.payment_requested && selectedSession?.cost_type !== 'Individual') || adminAvailabilityUpdating} 
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--theme-border)', background: 'var(--theme-surface-alt)', color: 'var(--theme-text)', fontSize: '0.875rem' }}
              >
                <option value="">Select a user...</option>
                {allUsers.map((u) => (
                  <option key={u.email} value={u.email}>{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <button 
            onClick={handleAdminSetAvailability} 
            disabled={!selectedUserEmail || (selectedSession?.payment_requested && selectedSession?.cost_type !== 'Individual') || adminAvailabilityUpdating} 
            style={{ 
              width: '100%', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              background: (!selectedUserEmail || (selectedSession?.payment_requested && selectedSession?.cost_type !== 'Individual') || adminAvailabilityUpdating) ? 'var(--theme-border)' : 'var(--theme-accent)', 
              color: (!selectedUserEmail || (selectedSession?.payment_requested && selectedSession?.cost_type !== 'Individual') || adminAvailabilityUpdating) ? 'var(--theme-text-muted)' : 'var(--theme-accent-contrast)', 
              border: 'none', 
              cursor: (!selectedUserEmail || (selectedSession?.payment_requested && selectedSession?.cost_type !== 'Individual') || adminAvailabilityUpdating) ? 'not-allowed' : 'pointer', 
              fontWeight: '600', 
              fontSize: '0.875rem', 
              transition: 'all 0.2s' 
            }}
          >
            {adminAvailabilityUpdating ? 'Updating...' : 'Set Availability'}
          </button>
          {adminAvailabilityError && <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--theme-danger)' }}>{adminAvailabilityError}</p>}
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
            {(selectedSession?.payment_requested && selectedSession?.cost_type !== 'Individual') ? 'Cannot change availability after payment request for Total cost type.' : 'Admins can add or modify member availability.'}
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
