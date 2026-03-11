import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login({ setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)

    const res = await fetch('/api/token', { method: 'POST', body: form })
    if (res.ok) {
      const { access_token } = await res.json()
      localStorage.setItem('token', access_token)
      const userRes = await fetch('/api/me', { headers: { Authorization: `Bearer ${access_token}` } })
      const userData = await userRes.json()
      setUser(userData)
      navigate('/')
    } else {
      setError('Invalid email or password')
    }
  }

  return (
    <div className="container" style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" className="nav-btn" style={{ width: '100%' }}>Log in</button>
      </form>
    </div>
  )
}
