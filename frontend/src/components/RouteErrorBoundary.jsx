import React from 'react'
import { useNavigate } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'

const RouteErrorFallback = ({ error, errorInfo, reset }) => {
  const navigate = useNavigate()

  const handleGoHome = () => {
    navigate('/')
  }

  const handleRetry = () => {
    reset()
  }

  return (
    <div style={{
      padding: '2rem',
      textAlign: 'center',
      backgroundColor: '#fef3c7',
      border: '1px solid #fde68a',
      borderRadius: '0.5rem',
      margin: '1rem',
      color: '#92400e'
    }}>
      <h2 style={{ marginBottom: '1rem', color: '#d97706' }}>
        Navigation Error
      </h2>
      <p style={{ marginBottom: '1rem' }}>
        There was an error loading this page. This might be due to an invalid route or a component error.
      </p>
      
      {process.env.NODE_ENV === 'development' && error && (
        <details style={{ 
          textAlign: 'left', 
          marginTop: '1rem', 
          padding: '1rem', 
          backgroundColor: '#fffbeb',
          borderRadius: '0.375rem',
          border: '1px solid #fde68a'
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Route Error Details (Development Only)
          </summary>
          <pre style={{ 
            fontSize: '0.875rem', 
            overflow: 'auto', 
            maxHeight: '200px',
            whiteSpace: 'pre-wrap',
            color: '#78350f'
          }}>
            {error.toString()}
            <br />
            {errorInfo.componentStack}
          </pre>
        </details>
      )}
      
      <div style={{ marginTop: '1.5rem' }}>
        <button
          onClick={handleRetry}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#d97706',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '1rem',
            marginRight: '0.5rem'
          }}
        >
          Retry Loading
        </button>
        <button
          onClick={handleGoHome}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Go Home
        </button>
      </div>
    </div>
  )
}

const RouteErrorBoundary = ({ children }) => {
  return (
    <ErrorBoundary
      message="There was an error loading this page. Please try again or navigate to a different page."
      fallback={RouteErrorFallback}
    >
      {children}
    </ErrorBoundary>
  )
}

export default RouteErrorBoundary
