import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and store in state
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo
    })

    // You could also send the error to a logging service here
    // logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    // Optionally navigate to a safe route
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          reset: this.handleReset
        })
      }

      // Default error UI
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          margin: '1rem',
          color: '#991b1b'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#dc2626' }}>
            Something went wrong
          </h2>
          <p style={{ marginBottom: '1rem' }}>
            {this.props.message || 'An unexpected error occurred. Please try refreshing the page.'}
          </p>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ 
              textAlign: 'left', 
              marginTop: '1rem', 
              padding: '1rem', 
              backgroundColor: '#fef2f2',
              borderRadius: '0.375rem',
              border: '1px solid #fecaca'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Error Details (Development Only)
              </summary>
              <pre style={{ 
                fontSize: '0.875rem', 
                overflow: 'auto', 
                maxHeight: '200px',
                whiteSpace: 'pre-wrap',
                color: '#7f1d1d'
              }}>
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          
          <div style={{ marginTop: '1.5rem' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '1rem',
                marginRight: '0.5rem'
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
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

    return this.props.children
  }
}

export default ErrorBoundary
