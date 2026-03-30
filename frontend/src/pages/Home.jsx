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
              <p>Share your ideas and help to grow the thriving football community of football lovers and volunteers.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
