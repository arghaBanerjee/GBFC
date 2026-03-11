import { useState, useEffect } from 'react'
import { apiUrl } from '../api'

export default function About() {
  const [about, setAbout] = useState(null)

  useEffect(() => {
    fetch(apiUrl('/api/about'))
      .then((r) => r.json())
      .then(setAbout)
  }, [])

  if (!about) return <div className="container"><p>Loading...</p></div>

  return (
    <div className="container">
      <h2>{about.club_name}</h2>
      <p>{about.summary}</p>
      <h3>Committee</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {about.committee.map((member, idx) => (
          <div key={idx} style={{ textAlign: 'center' }}>
            <img src={member.image} alt={member.name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover' }} />
            <h4>{member.name}</h4>
            <p>{member.role}</p>
          </div>
        ))}
      </div>
      <h3>Members</h3>
      <ul>
        {about.members.map((member, idx) => (
          <li key={idx}><strong>{member.name}</strong> – {member.intro}</li>
        ))}
      </ul>
    </div>
  )
}
