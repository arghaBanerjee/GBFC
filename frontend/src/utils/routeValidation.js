import React from 'react'

// Route validation middleware and utilities

export const VALID_ADMIN_TABS = ['events', 'users', 'expense', 'reports', 'notifications']

export const VALID_MATCH_TABS = ['upcoming', 'past']

export const VALID_USER_ACTIONS_TABS = ['events', 'payments']

/**
 * Validates admin tab parameter
 * @param {string} tab - Tab parameter from URL
 * @returns {string|null} Valid tab or null if invalid
 */
export const validateAdminTab = (tab) => {
  if (!tab || typeof tab !== 'string') return null
  return VALID_ADMIN_TABS.includes(tab) ? tab : null
}

/**
 * Validates matches tab parameter
 * @param {string} tab - Tab parameter from URL
 * @returns {string} Valid tab (defaults to 'upcoming' if invalid)
 */
export const validateMatchTab = (tab) => {
  if (!tab || typeof tab !== 'string') return 'upcoming'
  return VALID_MATCH_TABS.includes(tab) ? tab : 'upcoming'
}

/**
 * Validates user actions tab parameter
 * @param {string} tab - Tab parameter from URL
 * @returns {string} Valid tab (defaults to 'events' if invalid)
 */
export const validateUserActionsTab = (tab) => {
  if (!tab || typeof tab !== 'string') return 'events'
  return VALID_USER_ACTIONS_TABS.includes(tab) ? tab : 'events'
}

/**
 * Creates a route validator component that handles invalid routes gracefully
 * @param {Object} options - Validation options
 * @param {string} options.redirectTo - Default redirect path for invalid routes
 * @param {Function} options.validator - Function to validate route parameters
 * @param {Function} options.onInvalidRoute - Callback when invalid route is detected
 */
export const createRouteValidator = (options = {}) => {
  const {
    redirectTo,
    validator,
    onInvalidRoute,
    showMessage = true
  } = options

  return (paramValue) => {
    const isValid = validator(paramValue)
    
    if (!isValid && redirectTo) {
      if (onInvalidRoute) {
        onInvalidRoute(paramValue, redirectTo)
      }
      
      if (showMessage) {
        // Store message for display
        const message = `Invalid route parameter: "${paramValue}". Redirecting to "${redirectTo}"`
        console.warn(message)
        // Could also show a toast notification here
        sessionStorage.setItem('routeValidationMessage', message)
      }
      
      return { isValid: false, redirectTo, validatedValue: null }
    }
    
    return { isValid: true, redirectTo: null, validatedValue: isValid }
  }
}

/**
 * Hook to handle route validation messages
 * @returns {string|null} Validation message if present
 */
export const useRouteValidationMessage = () => {
  const [message, setMessage] = React.useState(null)
  
  React.useEffect(() => {
    const storedMessage = sessionStorage.getItem('routeValidationMessage')
    if (storedMessage) {
      setMessage(storedMessage)
      sessionStorage.removeItem('routeValidationMessage')
      
      // Auto-clear message after 5 seconds
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [])
  
  return message
}
