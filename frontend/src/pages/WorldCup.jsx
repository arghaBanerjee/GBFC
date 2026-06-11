import { useState, useEffect, useCallback } from 'react'
import { apiUrl } from '../api'

// ── colour palette ──────────────────────────────────────────────────────────
const C = {
  gold:      '#f59e0b',
  goldLight: '#fef3c7',
  goldDark:  '#b45309',
  red:       '#dc2626',
  redLight:  '#fee2e2',
  blue:      '#1d4ed8',
  blueLight: '#dbeafe',
  green:     '#16a34a',
  greenLight:'#dcfce7',
  purple:    '#7c3aed',
  purpleLight:'#ede9fe',
  bg:        '#0f172a',   // deep navy
  card:      '#1e293b',
  cardBorder:'#334155',
  text:      '#f1f5f9',
  muted:     '#94a3b8',
}

const STAGE_COLORS = {
  group:        { bg: '#1e3a5f', border: '#3b82f6', label: '#93c5fd' },
  round_of_32:  { bg: '#1a3a2a', border: '#22c55e', label: '#86efac' },
  round_of_16:  { bg: '#3b1f6e', border: '#a78bfa', label: '#c4b5fd' },
  quarter_final:{ bg: '#5c1a1a', border: '#ef4444', label: '#fca5a5' },
  semi_final:   { bg: '#713f12', border: '#f59e0b', label: '#fcd34d' },
  third_place:  { bg: '#1c4532', border: '#10b981', label: '#6ee7b7' },
  final:        { bg: '#450a0a', border: '#ef4444', label: '#fbbf24', glow: true },
}

const MEDAL = ['🥇','🥈','🥉']
const TABS  = ['Fixtures & Predict','My Predictions','Leaderboard']

// ── helpers ──────────────────────────────────────────────────────────────────
function isPast(dateStr, timeStr) {
  // Times stored as BST (UTC+1)
  const dt = new Date(`${dateStr}T${timeStr || '00:00'}:00+01:00`)
  return Date.now() >= dt.getTime()
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hh = parseInt(h, 10)
  return `${hh > 12 ? hh - 12 : hh || 12}:${m} ${hh >= 12 ? 'PM' : 'AM'}`
}

function PointsBadge({ pts, multiplier }) {
  if (pts === null || pts === undefined) return (
    <span style={{ background: '#334155', color: C.muted, borderRadius: 8, padding: '2px 8px', fontSize: 11 }}>
      Pending
    </span>
  )
  const color = pts === 0 ? C.red : pts >= 30 * multiplier ? C.gold : C.green
  return (
    <span style={{ background: color + '22', border: `1px solid ${color}`, color, borderRadius: 8, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
      +{pts} pts
    </span>
  )
}

function StagePill({ stage, label }) {
  const sc = STAGE_COLORS[stage] || STAGE_COLORS.group
  return (
    <span style={{
      background: sc.bg, border: `1px solid ${sc.border}`, color: sc.label,
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
    }}>{label}</span>
  )
}

// ── match card ────────────────────────────────────────────────────────────────
function MatchCard({ match, onPredict, saving }) {
  const locked   = isPast(match.date, match.time)
  const hasResult = !!match.result
  const pred      = match.prediction
  const sc        = STAGE_COLORS[match.stage] || STAGE_COLORS.group
  const isFinal   = match.stage === 'final'

  const [home, setHome] = useState(pred?.home_goals ?? '')
  const [away, setAway] = useState(pred?.away_goals ?? '')

  useEffect(() => {
    setHome(pred?.home_goals ?? '')
    setAway(pred?.away_goals ?? '')
  }, [pred?.home_goals, pred?.away_goals])

  const handleChange = (setter) => (e) => {
    const v = e.target.value
    if (v === '' || (/^\d+$/.test(v) && parseInt(v) <= 30)) setter(v)
  }

  const canSave = home !== '' && away !== '' && !locked

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${isFinal ? C.gold : sc.border}`,
      borderRadius: 14,
      padding: '1.1rem 1.25rem',
      boxShadow: isFinal ? `0 0 18px ${C.gold}44` : `0 2px 8px #0008`,
      transition: 'transform 0.15s',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* top stripe */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: isFinal ? `linear-gradient(90deg,${C.gold},${C.red})` : sc.border }} />

      {/* header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.65rem', gap: 8 }}>
        <StagePill stage={match.stage} label={match.stage_label} />
        <span style={{ color: C.muted, fontSize: 12 }}>
          {fmtDate(match.date)} {fmtTime(match.time)}
        </span>
      </div>

      {/* teams + scores row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap: '0.5rem', marginBottom:'0.85rem' }}>
        {/* home team */}
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{match.home_team}</div>
        </div>

        {/* centre: result or VS */}
        <div style={{ textAlign:'center', minWidth: 64 }}>
          {hasResult ? (
            <div style={{ fontSize: 20, fontWeight: 800, color: C.gold, letterSpacing: 2 }}>
              {match.result.home_goals} – {match.result.away_goals}
            </div>
          ) : locked ? (
            <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Started</div>
          ) : (
            <div style={{ fontSize: 15, color: C.muted, fontWeight: 700 }}>vs</div>
          )}
        </div>

        {/* away team */}
        <div style={{ textAlign:'left' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{match.away_team}</div>
        </div>
      </div>

      {/* venue */}
      {match.location && (
        <div style={{ color: C.muted, fontSize: 11, marginBottom: '0.75rem', textAlign:'center' }}>
          📍 {match.location}
        </div>
      )}

      {/* multiplier badge */}
      <div style={{ textAlign:'center', marginBottom:'0.75rem' }}>
        <span style={{ background:'#1e293b', border:`1px solid ${sc.border}`, color: sc.label, borderRadius: 20, padding:'2px 12px', fontSize:11, fontWeight:600 }}>
          ×{match.multiplier} points multiplier
        </span>
      </div>

      {/* prediction inputs */}
      {!locked && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 32px 1fr', alignItems:'center', gap: 8, marginBottom: 10 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{match.home_team}</div>
              <input
                type="number" min={0} max={30}
                value={home}
                onChange={handleChange(setHome)}
                placeholder="0"
                style={{
                  width: '100%', padding: '8px 4px', textAlign:'center', fontSize: 20, fontWeight: 700,
                  background: '#0f172a', color: C.text, border: `2px solid ${home !== '' ? sc.border : '#334155'}`,
                  borderRadius: 10, outline:'none',
                }}
              />
            </div>
            <div style={{ textAlign:'center', color: C.muted, fontWeight: 700 }}>–</div>
            <div style={{ textAlign:'center' }}>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{match.away_team}</div>
              <input
                type="number" min={0} max={30}
                value={away}
                onChange={handleChange(setAway)}
                placeholder="0"
                style={{
                  width: '100%', padding: '8px 4px', textAlign:'center', fontSize: 20, fontWeight: 700,
                  background: '#0f172a', color: C.text, border: `2px solid ${away !== '' ? sc.border : '#334155'}`,
                  borderRadius: 10, outline:'none',
                }}
              />
            </div>
          </div>
          <button
            onClick={() => { if (canSave) onPredict(match.id, parseInt(home), parseInt(away)) }}
            disabled={!canSave || saving === match.id}
            style={{
              width: '100%', padding: '9px', borderRadius: 10, border:'none',
              background: canSave ? `linear-gradient(135deg,${sc.border},${isFinal ? C.gold : sc.border}cc)` : '#334155',
              color: canSave ? '#fff' : C.muted,
              fontWeight: 700, fontSize: 13, cursor: canSave ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.2s',
              opacity: saving === match.id ? 0.6 : 1,
            }}
          >
            {saving === match.id ? 'Saving…' : pred ? '✏️ Update Prediction' : '⚽ Predict Score'}
          </button>
        </div>
      )}

      {/* locked with prediction */}
      {locked && pred && (
        <div style={{ textAlign:'center' }}>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Your prediction</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            {pred.home_goals} – {pred.away_goals}
          </div>
          <PointsBadge pts={pred.points_awarded} multiplier={match.multiplier} />
        </div>
      )}

      {/* locked without prediction */}
      {locked && !pred && (
        <div style={{ textAlign:'center', color: C.muted, fontSize: 12 }}>
          🔒 Predictions closed — no prediction submitted
        </div>
      )}
    </div>
  )
}

// ── leaderboard ───────────────────────────────────────────────────────────────
function Leaderboard({ data, loading }) {
  if (loading) return <div style={{ textAlign:'center', color: C.muted, padding: 40 }}>Loading…</div>
  if (!data.length) return <div style={{ textAlign:'center', color: C.muted, padding: 40 }}>No predictions yet. Be the first!</div>

  return (
    <div>
      {/* podium for top 3 */}
      {data.length >= 3 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.15fr 1fr', gap: 12, marginBottom: 24, alignItems:'flex-end' }}>
          {[data[1], data[0], data[2]].map((entry, i) => {
            const heights = ['80px','110px','70px']
            const colors  = [C.muted, C.gold, '#cd7f32']
            const medals  = ['🥈','🥇','🥉']
            const idx     = i === 0 ? 1 : i === 1 ? 0 : 2
            return (
              <div key={entry.email} style={{
                background: C.card, border: `2px solid ${colors[i]}`,
                borderRadius: 12, padding: '12px 8px', textAlign:'center',
                boxShadow: i === 1 ? `0 0 24px ${C.gold}44` : 'none',
              }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{medals[i]}</div>
                <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 4, wordBreak:'break-word' }}>
                  {entry.name.split(' ')[0]}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: colors[i] }}>{entry.total_points}</div>
                <div style={{ fontSize: 10, color: C.muted }}>pts</div>
              </div>
            )
          })}
        </div>
      )}

      {/* full table */}
      <div style={{ borderRadius: 12, overflow:'hidden', border:`1px solid ${C.cardBorder}` }}>
        {data.map((entry, i) => (
          <div key={entry.email} style={{
            display:'grid', gridTemplateColumns:'40px 1fr auto auto',
            alignItems:'center', gap: 12, padding: '12px 16px',
            background: entry.is_me ? '#1a2744' : i % 2 === 0 ? C.card : '#253044',
            borderBottom: i < data.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
          }}>
            <div style={{ textAlign:'center', fontWeight: 800, fontSize: 14, color: i < 3 ? [C.gold, C.muted, '#cd7f32'][i] : C.muted }}>
              {i < 3 ? MEDAL[i] : `#${i + 1}`}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: entry.is_me ? C.gold : C.text, fontSize: 14 }}>
                {entry.name} {entry.is_me && <span style={{ fontSize: 10, color: C.gold }}>(You)</span>}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {entry.predictions_made} predictions · {entry.results_in} results in
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: entry.is_me ? C.gold : C.text }}>{entry.total_points}</div>
              <div style={{ fontSize: 10, color: C.muted }}>pts</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── my predictions tab ────────────────────────────────────────────────────────
function MyPredictions({ data, loading }) {
  if (loading) return <div style={{ textAlign:'center', color: C.muted, padding: 40 }}>Loading…</div>
  if (!data.length) return (
    <div style={{ textAlign:'center', color: C.muted, padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔮</div>
      <div>No predictions yet. Head to Fixtures to start predicting!</div>
    </div>
  )

  const totalPts = data.reduce((s, p) => s + (p.points_awarded || 0), 0)
  const resultsIn = data.filter(p => p.points_awarded !== null).length

  return (
    <div>
      {/* summary bar */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { label:'Predictions', val: data.length, icon:'⚽', color: C.blue },
          { label:'Results In',  val: resultsIn,   icon:'✅', color: C.green },
          { label:'Total Points',val: totalPts,    icon:'⭐', color: C.gold },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border:`1px solid ${C.cardBorder}`, borderRadius:12, padding:'14px 10px', textAlign:'center' }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {data.map(p => {
        const hasResult = p.actual_home !== null && p.actual_home !== undefined
        const correct_score = hasResult && p.predicted_home === p.actual_home && p.predicted_away === p.actual_away
        const sc = STAGE_COLORS[p.stage] || STAGE_COLORS.group
        return (
          <div key={p.match_id} style={{
            background: C.card, border: `1px solid ${sc.border}`,
            borderRadius: 12, padding: '1rem 1.1rem', marginBottom: 10,
            display:'grid', gridTemplateColumns:'1fr auto', gap: 10, alignItems:'center',
          }}>
            <div>
              <div style={{ display:'flex', gap: 8, alignItems:'center', marginBottom: 6 }}>
                <StagePill stage={p.stage} label={p.stage_label} />
                <span style={{ color: C.muted, fontSize: 11 }}>{fmtDate(p.date)}</span>
              </div>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>
                {p.home_team} vs {p.away_team}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Your pick: <span style={{ color: correct_score ? C.gold : C.text, fontWeight: 700 }}>
                  {p.predicted_home} – {p.predicted_away}
                </span>
                {hasResult && (
                  <> &nbsp;·&nbsp; Result: <span style={{ color: C.gold, fontWeight: 700 }}>
                    {p.actual_home} – {p.actual_away}
                  </span></>
                )}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <PointsBadge pts={hasResult ? p.points_awarded : undefined} multiplier={p.multiplier} />
              {correct_score && <div style={{ fontSize: 18, marginTop: 4 }}>🎯</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function WorldCup({ user }) {
  const [tab, setTab]           = useState(0)
  const [matches, setMatches]   = useState([])
  const [myPreds, setMyPreds]   = useState([])
  const [leaderboard, setLB]    = useState([])
  const [loadingM, setLoadingM] = useState(true)
  const [loadingL, setLoadingL] = useState(false)
  const [loadingP, setLoadingP] = useState(false)
  const [saving, setSaving]     = useState(null)
  const [error, setError]       = useState('')
  const [filterStage, setFilterStage] = useState('all')

  const token = localStorage.getItem('token')
  const headers = { 'Content-Type':'application/json', Authorization:`Bearer ${token}` }

  const loadMatches = useCallback(async () => {
    setLoadingM(true)
    try {
      const res = await fetch(apiUrl('/api/worldcup/matches'), { headers })
      if (res.ok) setMatches(await res.json())
    } catch(e) { setError('Failed to load matches') }
    finally { setLoadingM(false) }
  }, [])

  const loadLeaderboard = useCallback(async () => {
    setLoadingL(true)
    try {
      const res = await fetch(apiUrl('/api/worldcup/leaderboard'), { headers })
      if (res.ok) setLB(await res.json())
    } catch(e) {}
    finally { setLoadingL(false) }
  }, [])

  const loadMyPreds = useCallback(async () => {
    setLoadingP(true)
    try {
      const res = await fetch(apiUrl('/api/worldcup/my-predictions'), { headers })
      if (res.ok) setMyPreds(await res.json())
    } catch(e) {}
    finally { setLoadingP(false) }
  }, [])

  useEffect(() => { loadMatches() }, [])
  useEffect(() => { if (tab === 2) loadLeaderboard() }, [tab])
  useEffect(() => { if (tab === 1) loadMyPreds() }, [tab])

  const handlePredict = async (matchId, homeGoals, awayGoals) => {
    setSaving(matchId)
    setError('')
    try {
      const res = await fetch(apiUrl('/api/worldcup/predict'), {
        method:'POST', headers,
        body: JSON.stringify({ match_id: matchId, home_goals: homeGoals, away_goals: awayGoals }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Failed to save prediction'); return }
      // Refresh matches to get updated prediction
      await loadMatches()
    } catch(e) { setError('Failed to save prediction') }
    finally { setSaving(null) }
  }

  // Group matches by stage for display
  const stages = ['group','round_of_32','round_of_16','quarter_final','semi_final','third_place','final']
  const grouped = stages.reduce((acc, s) => {
    const ms = matches.filter(m => m.stage === s)
    if (ms.length) acc[s] = ms
    return acc
  }, {})

  const filteredGroups = filterStage === 'all'
    ? grouped
    : Object.fromEntries(Object.entries(grouped).filter(([k]) => k === filterStage))

  const upcomingCount = matches.filter(m => !isPast(m.date, m.time) && !m.prediction).length

  return (
    <div style={{ minHeight:'100vh', background: C.bg, color: C.text, paddingBottom: 60 }}>

      {/* ── Hero Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #450a0a 100%)',
        borderBottom: `2px solid ${C.gold}`,
        padding: '2rem 1rem 1.5rem',
        textAlign:'center',
        position:'relative', overflow:'hidden',
      }}>
        {/* decorative orbs */}
        <div style={{ position:'absolute', top:-40, left:-40, width:160, height:160, borderRadius:'50%', background:`radial-gradient(${C.gold}22,transparent)` }} />
        <div style={{ position:'absolute', bottom:-30, right:-30, width:120, height:120, borderRadius:'50%', background:`radial-gradient(${C.red}22,transparent)` }} />

        <div style={{ fontSize: 48, marginBottom: 6 }}>🏆</div>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 1, background:`linear-gradient(90deg,${C.gold},#fff,${C.gold})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom: 4 }}>
          2026 FIFA World Cup
        </div>
        <div style={{ fontSize: 15, color: C.gold, fontWeight: 700, letterSpacing: 3, textTransform:'uppercase', marginBottom: 16 }}>
          Prediction Challenge
        </div>
        {/* points guide */}
        <div style={{ display:'flex', justifyContent:'center', gap: 10, flexWrap:'wrap', marginBottom: 12 }}>
          {[
            { icon:'🏅', text:'Correct winner', pts:'10 pts' },
            { icon:'🎯', text:'Exact score (both goals)', pts:'20 pts' },
            { icon:'⚽', text:'One team\'s goals', pts:'10 pts' },
          ].map(g => (
            <div key={g.text} style={{ background:'#ffffff12', border:`1px solid ${C.gold}44`, borderRadius:10, padding:'6px 12px', fontSize:12 }}>
              <span>{g.icon}</span> {g.text} <span style={{ color: C.gold, fontWeight:700 }}>{g.pts}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>
          Points multiplied by round — max <span style={{ color: C.gold, fontWeight:700 }}>180 pts</span> per Final prediction!
        </div>
        {upcomingCount > 0 && (
          <div style={{ marginTop: 12, background:`${C.gold}22`, border:`1px solid ${C.gold}`, borderRadius:10, display:'inline-block', padding:'6px 16px', fontSize:13, color: C.gold, fontWeight:600 }}>
            🔮 {upcomingCount} match{upcomingCount !== 1 ? 'es' : ''} still open for prediction!
          </div>
        )}
      </div>

      <div style={{ maxWidth: 700, margin:'0 auto', padding:'0 12px' }}>

        {/* ── Tabs ── */}
        <div style={{ display:'flex', gap: 0, margin:'16px 0 20px', background: C.card, borderRadius:12, padding: 4, border:`1px solid ${C.cardBorder}` }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              flex:1, padding:'9px 4px', border:'none', borderRadius:10, fontWeight:600, fontSize:13,
              cursor:'pointer', transition:'all 0.2s',
              background: tab === i ? `linear-gradient(135deg,${C.blue},${C.purple})` : 'transparent',
              color: tab === i ? '#fff' : C.muted,
            }}>{t}</button>
          ))}
        </div>

        {error && (
          <div style={{ background: C.redLight, color: C.red, borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13 }}>
            {error}
          </div>
        )}

        {/* ── Tab 0: Fixtures ── */}
        {tab === 0 && (
          <>
            {/* stage filter */}
            <div style={{ display:'flex', gap: 8, flexWrap:'wrap', marginBottom:16, overflowX:'auto', paddingBottom: 4 }}>
              <button onClick={() => setFilterStage('all')} style={{
                padding:'5px 12px', borderRadius:20, border:`1px solid ${filterStage==='all'?C.gold:C.cardBorder}`,
                background: filterStage==='all' ? `${C.gold}22` : 'transparent', color: filterStage==='all' ? C.gold : C.muted,
                fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
              }}>All Matches</button>
              {Object.keys(grouped).map(s => {
                const sc = STAGE_COLORS[s] || STAGE_COLORS.group
                const active = filterStage === s
                return (
                  <button key={s} onClick={() => setFilterStage(s)} style={{
                    padding:'5px 12px', borderRadius:20, border:`1px solid ${active?sc.border:C.cardBorder}`,
                    background: active ? sc.bg : 'transparent', color: active ? sc.label : C.muted,
                    fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
                  }}>{Object.keys(STAGE_COLORS).indexOf(s) === 6 ? '🏆 Final' : {
                    group:'Group Stage', round_of_32:'R32', round_of_16:'R16',
                    quarter_final:'QF', semi_final:'SF', third_place:'3rd Place',
                  }[s]}</button>
                )
              })}
            </div>

            {loadingM ? (
              <div style={{ textAlign:'center', color: C.muted, padding: 40 }}>Loading matches…</div>
            ) : (
              Object.entries(filteredGroups).map(([stage, stageMatches]) => {
                const sc = STAGE_COLORS[stage] || STAGE_COLORS.group
                return (
                  <div key={stage} style={{ marginBottom: 28 }}>
                    <div style={{
                      display:'flex', alignItems:'center', gap: 10, marginBottom: 12,
                      paddingBottom: 8, borderBottom:`1px solid ${sc.border}44`,
                    }}>
                      <div style={{ width:4, height:20, borderRadius:2, background: sc.border }} />
                      <span style={{ fontSize:14, fontWeight:800, color: sc.label, textTransform:'uppercase', letterSpacing:1 }}>
                        {stage === 'final' ? '🏆 ' : ''}{Object.values({ group:'Group Stage', round_of_32:'Round of 32', round_of_16:'Round of 16', quarter_final:'Quarter-Finals', semi_final:'Semi-Finals', third_place:'Third Place', final:'The Final' })[Object.keys({group:'',round_of_32:'',round_of_16:'',quarter_final:'',semi_final:'',third_place:'',final:''}).indexOf(stage)]}
                      </span>
                      <span style={{ marginLeft:'auto', background: sc.bg, color: sc.label, borderRadius:20, padding:'2px 10px', fontSize:11 }}>
                        ×{stageMatches[0]?.multiplier} pts
                      </span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
                      {stageMatches.map(m => (
                        <MatchCard key={m.id} match={m} onPredict={handlePredict} saving={saving} />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {/* ── Tab 1: My Predictions ── */}
        {tab === 1 && <MyPredictions data={myPreds} loading={loadingP} />}

        {/* ── Tab 2: Leaderboard ── */}
        {tab === 2 && <Leaderboard data={leaderboard} loading={loadingL} />}
      </div>
    </div>
  )
}
