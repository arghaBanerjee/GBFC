import { useNavigate } from 'react-router-dom'

export default function Home({ user }) {
  const navigate = useNavigate()

  return (
    <div className="container">
      <div className="hero">
        <div className="hero-content">
          <div className="hero-badge">Glasgow Bengali Football Club · Est. 2024</div>
          <h1 className="hero-title">Welcome to Glasgow Bengali Football Club</h1>
          <p className="hero-subtitle">
            A community-driven Bengali football club in Glasgow, bringing players, families, and fans together for the love of the beautiful game.
          </p>
          <div className="hero-grid">
            <div className="hero-card" onClick={() => navigate('/matches/upcoming')}>
              <h4>Match Centre</h4>
              <p>See past and upcoming match fixtures, results, and match highlights.</p>
            </div>
            <div className="hero-card" onClick={() => navigate('/calendar')}>
              <h4>Club Calendar</h4>
              <p>Track upcoming events including practice sessions, matches, social events and share your availability.</p>
            </div>
            <div className="hero-card" onClick={() => navigate('/forum')}>
              <h4>Community Forum</h4>
              <p>Share your ideas and help to grow the thriving community of football lovers, players and volunteers.</p>
            </div>
          </div>
          <div className="hero-social">
            <p className="hero-social-text">Follow us on Instagram and YouTube</p>
            <div className="hero-social-icons">
              <a
                href="https://www.instagram.com/glasgowbengalifc/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="social-icon"
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <path
                    d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path d="M17.5 6.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@GlasgowBengaliFC"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="social-icon"
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                  <path
                    d="M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C15.8 4 12 4 12 4h0s-3.8 0-6.7.3c-.4.1-1.3.1-2.1.9-.6.6-.8 2-.8 2S2 8.8 2 10.4v1.5c0 1.6.4 3.2.4 3.2s.2 1.4.8 2c.8.8 1.9.8 2.4.9 1.7.2 6.4.3 6.4.3s3.8 0 6.7-.3c.4-.1 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.4-1.6.4-3.2v-1.5c0-1.6-.4-3.2-.4-3.2Z"
                    fill="currentColor"
                    opacity="0.18"
                  />
                  <path d="M10 9.5v5l5-2.5-5-2.5Z" fill="currentColor" />
                  <path
                    d="M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C15.8 4 12 4 12 4h0s-3.8 0-6.7.3c-.4.1-1.3.1-2.1.9-.6.6-.8 2-.8 2S2 8.8 2 10.4v1.5c0 1.6.4 3.2.4 3.2s.2 1.4.8 2c.8.8 1.9.8 2.4.9 1.7.2 6.4.3 6.4.3s3.8 0 6.7-.3c.4-.1 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.4-1.6.4-3.2v-1.5c0-1.6-.4-3.2-.4-3.2Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
