import { useState } from 'react'
import BatSwing from './BatSwing'
import './BatSwing.css'

function App() {
  const [swings, setSwings] = useState([])
  const [lastPower, setLastPower] = useState(null)

  const handleSwing = (power) => {
    const result = getSwingResult(power)
    setLastPower(power)
    setSwings((prev) => [{ power, result, id: Date.now() }, ...prev].slice(0, 20))
  }

  return (
    <div className="demo-page">
      <header className="demo-header">
        <h1>Bat Swing</h1>
        <p className="demo-subtitle">
          Pull down to load. Release to swing.
        </p>
      </header>

      <div className="demo-stage">
        <BatSwing onSwing={handleSwing} threshold={0.25} />
      </div>

      {lastPower !== null && (
        <div className="demo-result" key={swings[0]?.id}>
          <div className="demo-result-icon">{swings[0]?.result.emoji}</div>
          <div className="demo-result-text">{swings[0]?.result.label}</div>
          <div className="demo-result-power">
            {Math.round(lastPower * 100)}% power
          </div>
        </div>
      )}

      {swings.length > 0 && (
        <div className="demo-history">
          <h3>Swing History</h3>
          <div className="demo-history-list">
            {swings.map((s) => (
              <div key={s.id} className="demo-history-item">
                <span className="demo-history-emoji">{s.result.emoji}</span>
                <span className="demo-history-label">{s.result.label}</span>
                <span className="demo-history-pwr">
                  {Math.round(s.power * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="demo-footer">
        <p>
          Portable React component. Drag down to cock the bat back, release to
          swing. Works on touch and mouse. Import <code>BatSwing</code> +{' '}
          <code>BatSwing.css</code> into any project.
        </p>
      </footer>
    </div>
  )
}

function getSwingResult(power) {
  if (power >= 0.95) return { emoji: '\u{1F4A5}', label: 'HOME RUN!' }
  if (power >= 0.8) return { emoji: '\u{1F525}', label: 'Triple!' }
  if (power >= 0.6) return { emoji: '\u{1F4AA}', label: 'Double!' }
  if (power >= 0.4) return { emoji: '\u2705', label: 'Base Hit' }
  return { emoji: '\u{1F44B}', label: 'Foul Ball' }
}

export default App
