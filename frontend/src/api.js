// API utility for centralized API calls with configurable base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const apiUrl = (path) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `${API_BASE_URL}/${cleanPath}`
}

export const apiFetch = async (path, options = {}) => {
  const url = apiUrl(path)
  return fetch(url, options)
}

export default { apiUrl, apiFetch }
