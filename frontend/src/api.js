// API utility for centralized API calls with configurable base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const apiUrl = (path) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `${API_BASE_URL}/${cleanPath}`
}

export const getPlatform = () => {
  if (typeof window === 'undefined') return 'unknown'

  // Check if running as PWA (standalone mode)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.matchMedia('(display-mode: minimal-ui)').matches

  // iOS specific check
  const isIOSStandalone = window.navigator.standalone === true

  if (isStandalone || isIOSStandalone) {
    return 'pwa'
  }

  return 'browser'
}

export const apiFetch = async (path, options = {}) => {
  const url = apiUrl(path)
  return fetch(url, options)
}

export default { apiUrl, apiFetch, getPlatform }
