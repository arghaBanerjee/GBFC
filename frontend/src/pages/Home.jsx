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
            A community-driven Bengali football club in Glasgow, bringing players, families, and fans together every week.
            Check upcoming fixtures, training sessions, and relive our best moments.
          </p>
          <div className="hero-grid">
            <div className="hero-card" onClick={() => navigate('/matches')}>
              <h4>Match Centre</h4>
              <p>See past and upcoming fixtures, results, and match highlights.</p>
            </div>
            <div className="hero-card" onClick={() => navigate('/book-practice')}>
              <h4>Training Schedule</h4>
              <p>Track Thursday practice sessions and share your availability.</p>
            </div>
            <div className="hero-card" onClick={() => navigate('/forum')}>
              <h4>Club Community</h4>
              <p>Meet the Glasgow Bengali football community, volunteers, and committee behind the club.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="metrics">
        <div className="metric-card">
          <div className="metric-value">32</div>
          <div className="metric-label">Registered Players</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">4</div>
          <div className="metric-label">Seasons Played</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">120+</div>
          <div className="metric-label">Community Members</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">9</div>
          <div className="metric-label">Total Events</div>
        </div>
      </div>
    </div>
  )
}
