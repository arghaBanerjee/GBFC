import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const MAINTENANCE_MODE = (import.meta.env.VITE_MAINTENANCE_MODE || 'false') === 'true'

function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'linear-gradient(180deg, var(--theme-bg, #0f172a) 0%, var(--theme-surface, #111827) 100%)',
        color: 'var(--theme-text, #f8fafc)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '40rem',
          textAlign: 'center',
          padding: '2.5rem 2rem',
          borderRadius: '1.5rem',
          background: 'rgba(15, 23, 42, 0.72)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          boxShadow: '0 24px 60px rgba(2, 6, 23, 0.35)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: '1rem' }}>
          Maintenance Mode
        </div>
        <h1 style={{ margin: '0 0 1rem', fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1 }}>
          We&rsquo;ll be back shortly
        </h1>
        <p style={{ margin: '0 auto', maxWidth: '32rem', fontSize: '1.05rem', lineHeight: 1.7, color: 'rgba(226, 232, 240, 0.92)' }}>
          Glasgow Bengali FC is temporarily unavailable while we carry out scheduled maintenance. Please check back again soon.
        </p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {MAINTENANCE_MODE ? (
      <MaintenancePage />
    ) : (
      <BrowserRouter future={{ v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>,
)
