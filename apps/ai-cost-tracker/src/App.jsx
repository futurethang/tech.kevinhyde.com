import { useState, useEffect } from 'react'

// Model data with energy consumption estimates
// Based on research from Epoch AI, Jegham et al. 2025, and industry benchmarks
// Energy values in Wh per token - estimates where official data unavailable
// Note: Anthropic/OpenAI don't officially disclose per-token energy data
const MODELS = {
  // === Anthropic Claude Models ===
  'claude-opus-4-5': {
    name: 'Claude Opus 4.5',
    provider: 'Anthropic',
    energyPerInputToken: 0.0006,    // Estimated ~2x Sonnet based on pricing/capability ratio
    energyPerOutputToken: 0.0024,
    isReasoning: false,
    note: 'Estimate based on pricing ratio to Sonnet 4',
  },
  'claude-sonnet-4': {
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    energyPerInputToken: 0.0003,    // Similar efficiency to 3.7, eco-leader
    energyPerOutputToken: 0.0012,
    isReasoning: false,
    note: 'Claude models rank highest in eco-efficiency benchmarks',
  },
  'claude-3-7-sonnet': {
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    energyPerInputToken: 0.00025,   // Eco-efficiency leader (0.886 score)
    energyPerOutputToken: 0.001,
    isReasoning: false,
    note: 'Highest eco-efficiency score in 2025 benchmarks',
  },
  'claude-3-5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    energyPerInputToken: 0.00025,
    energyPerOutputToken: 0.001,
    isReasoning: false,
  },
  'claude-3-opus': {
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    energyPerInputToken: 0.0004,
    energyPerOutputToken: 0.0016,
    isReasoning: false,
  },
  'claude-3-haiku': {
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    energyPerInputToken: 0.00005,
    energyPerOutputToken: 0.0002,
    isReasoning: false,
  },
  // === OpenAI Models ===
  'gpt-5': {
    name: 'GPT-5',
    provider: 'OpenAI',
    energyPerInputToken: 0.002,     // ~8x GPT-4 per Jegham et al. 2025
    energyPerOutputToken: 0.018,    // Average ~18.35 Wh per 1000 token response
    isReasoning: false,
    note: 'Estimated 8x GPT-4 energy use per response',
  },
  'gpt-4-5': {
    name: 'GPT-4.5',
    provider: 'OpenAI',
    energyPerInputToken: 0.003,     // ~30 Wh for long prompts per Jegham study
    energyPerOutputToken: 0.012,
    isReasoning: false,
    note: 'High energy use per Jegham et al. 2025',
  },
  'gpt-4o': {
    name: 'GPT-4o',
    provider: 'OpenAI',
    energyPerInputToken: 0.0003,    // ~0.42 Wh short query
    energyPerOutputToken: 0.0012,
    isReasoning: false,
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    energyPerInputToken: 0.00008,
    energyPerOutputToken: 0.0003,
    isReasoning: false,
  },
  'o4-mini': {
    name: 'o4-mini (Reasoning)',
    provider: 'OpenAI',
    energyPerInputToken: 0.001,     // Eco-efficient reasoning (0.867 score)
    energyPerOutputToken: 0.004,
    isReasoning: true,
    note: 'Eco-efficient reasoning model',
  },
  'o3': {
    name: 'o3 (Reasoning)',
    provider: 'OpenAI',
    energyPerInputToken: 0.005,     // ~25.35 Wh per reasoning query
    energyPerOutputToken: 0.025,
    isReasoning: true,
    note: 'High energy reasoning model',
  },
  'o1': {
    name: 'o1 (Reasoning)',
    provider: 'OpenAI',
    energyPerInputToken: 0.002,
    energyPerOutputToken: 0.008,
    isReasoning: true,
  },
  // === Google Models ===
  'gemini-2-ultra': {
    name: 'Gemini 2.0 Ultra',
    provider: 'Google',
    energyPerInputToken: 0.0006,
    energyPerOutputToken: 0.0024,
    isReasoning: false,
  },
  'gemini-2-pro': {
    name: 'Gemini 2.0 Pro',
    provider: 'Google',
    energyPerInputToken: 0.0003,
    energyPerOutputToken: 0.0012,
    isReasoning: false,
  },
  'gemini-2-flash': {
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    energyPerInputToken: 0.0001,
    energyPerOutputToken: 0.0004,
    isReasoning: false,
  },
  // === Meta Models ===
  'llama-4-405b': {
    name: 'Llama 4 405B',
    provider: 'Meta',
    energyPerInputToken: 0.0005,
    energyPerOutputToken: 0.002,
    isReasoning: false,
  },
  'llama-3-70b': {
    name: 'Llama 3 70B',
    provider: 'Meta',
    energyPerInputToken: 0.0003,
    energyPerOutputToken: 0.0012,
    isReasoning: false,
  },
}

// Constants for environmental impact calculations
const CONSTANTS = {
  waterPerWh: 1.8,
  milkJugMl: 3785,
  glassOfWaterMl: 250,
  smartphoneChargeWh: 15,
  ledBulbHourWh: 10,
  laptopHourWh: 50,
  googleSearchWh: 0.0003,
}

function calculateImpact(inputTokens, outputTokens, model) {
  const modelData = MODELS[model]
  const inputEnergy = inputTokens * modelData.energyPerInputToken
  const outputEnergy = outputTokens * modelData.energyPerOutputToken
  const totalEnergy = inputEnergy + outputEnergy
  const waterMl = totalEnergy * CONSTANTS.waterPerWh

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    energyWh: totalEnergy,
    waterMl,
    smartphoneCharges: totalEnergy / CONSTANTS.smartphoneChargeWh,
    ledBulbHours: totalEnergy / CONSTANTS.ledBulbHourWh,
    laptopMinutes: (totalEnergy / CONSTANTS.laptopHourWh) * 60,
    googleSearches: totalEnergy / CONSTANTS.googleSearchWh,
    glassesOfWater: waterMl / CONSTANTS.glassOfWaterMl,
    milkJugs: waterMl / CONSTANTS.milkJugMl,
  }
}

function WaterGlass({ filled }) {
  const fillHeight = Math.round(50 * filled)
  const yPos = 60 - fillHeight - 10
  return (
    <div className="icon glass">
      <svg viewBox="0 0 40 60" className="glass-svg">
        <path d="M5 5 L10 55 L30 55 L35 5 Z" fill="none" stroke="currentColor" strokeWidth="2"/>
        {filled > 0 && (
          <rect x="8" y={yPos} width="24" height={fillHeight} fill="var(--water-color)" rx="2"/>
        )}
      </svg>
    </div>
  )
}

function WaterJug({ filled }) {
  const fillHeight = Math.round(44 * filled)
  const yPos = 62 - fillHeight
  return (
    <div className="icon jug">
      <svg viewBox="0 0 50 70" className="jug-svg">
        <path d="M15 10 L15 5 L25 2 L35 5 L35 10 M10 15 L10 65 L40 65 L40 15 L35 10 L15 10 L10 15 M25 2 L30 0 L35 2"
              fill="none" stroke="currentColor" strokeWidth="2"/>
        {filled > 0 && (
          <rect x="12" y={yPos} width="26" height={fillHeight} fill="var(--water-color)"/>
        )}
      </svg>
    </div>
  )
}

function WaterVisualization({ waterMl, glassesOfWater, milkJugs }) {
  const showGlasses = milkJugs < 0.5
  const fullGlasses = Math.floor(glassesOfWater)
  const partialGlass = glassesOfWater - fullGlasses
  const fullJugs = Math.floor(milkJugs)
  const partialJug = milkJugs - fullJugs

  const renderIcons = () => {
    const icons = []
    if (showGlasses) {
      const maxGlasses = Math.min(fullGlasses, 10)
      for (let i = 0; i < maxGlasses; i++) {
        icons.push(<WaterGlass key={`glass-${i}`} filled={1} />)
      }
      if (partialGlass > 0.05 && fullGlasses < 10) {
        icons.push(<WaterGlass key="partial-glass" filled={partialGlass} />)
      }
    } else {
      const maxJugs = Math.min(fullJugs, 5)
      for (let i = 0; i < maxJugs; i++) {
        icons.push(<WaterJug key={`jug-${i}`} filled={1} />)
      }
      if (partialJug > 0.05 && fullJugs < 5) {
        icons.push(<WaterJug key="partial-jug" filled={partialJug} />)
      }
      if (fullJugs > 5) {
        icons.push(<div key="overflow" className="overflow-indicator">+{fullJugs - 5} more</div>)
      }
    }
    return icons
  }

  return (
    <div className="visualization water-viz">
      <h3>Water Usage</h3>
      <div className="viz-value">
        <span className="big-number">{waterMl < 1 ? waterMl.toFixed(3) : waterMl.toFixed(1)}</span>
        <span className="unit">ml</span>
      </div>
      <div className="viz-icons">{renderIcons()}</div>
      <div className="viz-comparison">
        <p>{showGlasses ? `${glassesOfWater.toFixed(2)} glasses of water` : `${milkJugs.toFixed(2)} gallon jugs`}</p>
      </div>
    </div>
  )
}

function Phone({ filled }) {
  const fillHeight = Math.round(46 * filled)
  const yPos = 58 - fillHeight
  const pct = Math.round(filled * 100)
  return (
    <div className="icon phone">
      <svg viewBox="0 0 40 70" className="phone-svg">
        <rect x="5" y="2" width="30" height="66" rx="4" fill="none" stroke="currentColor" strokeWidth="2"/>
        <rect x="15" y="5" width="10" height="3" rx="1" fill="currentColor"/>
        {filled > 0 && (
          <rect x="8" y={yPos} width="24" height={fillHeight} fill="var(--electricity-color)"/>
        )}
        <text x="20" y="40" textAnchor="middle" fill={filled > 0.5 ? 'white' : 'currentColor'} fontSize="12" fontWeight="bold">
          {pct}%
        </text>
      </svg>
    </div>
  )
}

function ElectricityVisualization({ energyWh, smartphoneCharges, ledBulbHours, laptopMinutes }) {
  const fullPhones = Math.floor(smartphoneCharges)
  const partialPhone = smartphoneCharges - fullPhones

  let comparisonLabel
  if (energyWh < 0.1) {
    const secs = ledBulbHours * 60
    comparisonLabel = `${secs.toFixed(1)} seconds of a 10W LED bulb`
  } else if (energyWh < 15) {
    comparisonLabel = `${ledBulbHours.toFixed(2)} hours of a 10W LED bulb`
  } else if (energyWh < 100) {
    comparisonLabel = `${smartphoneCharges.toFixed(2)} smartphone charges`
  } else {
    const hrs = laptopMinutes / 60
    comparisonLabel = `${hrs.toFixed(1)} hours of laptop use`
  }

  const renderIcons = () => {
    const icons = []
    if (smartphoneCharges >= 0.01) {
      const maxPhones = Math.min(fullPhones, 5)
      for (let i = 0; i < maxPhones; i++) {
        icons.push(<Phone key={`phone-${i}`} filled={1} />)
      }
      if (partialPhone > 0.05 && fullPhones < 5) {
        icons.push(<Phone key="partial-phone" filled={partialPhone} />)
      }
      if (fullPhones > 5) {
        icons.push(<div key="overflow" className="overflow-indicator">+{fullPhones - 5} more</div>)
      }
    } else {
      icons.push(
        <div key="bulb" className="icon bulb dim">
          <svg viewBox="0 0 50 70" className="bulb-svg">
            <ellipse cx="25" cy="25" rx="20" ry="20" fill="none" stroke="currentColor" strokeWidth="2"/>
            <path d="M15 40 L15 55 L35 55 L35 40" fill="none" stroke="currentColor" strokeWidth="2"/>
            <line x1="15" y1="48" x2="35" y2="48" stroke="currentColor" strokeWidth="2"/>
            <ellipse cx="25" cy="25" rx="18" ry="18" fill="var(--electricity-dim)" opacity="0.5"/>
          </svg>
          <span className="dim-label">Barely a flicker</span>
        </div>
      )
    }
    return icons
  }

  return (
    <div className="visualization electricity-viz">
      <h3>Electricity Usage</h3>
      <div className="viz-value">
        <span className="big-number">{energyWh < 0.01 ? energyWh.toFixed(4) : energyWh.toFixed(2)}</span>
        <span className="unit">Wh</span>
      </div>
      <div className="viz-icons">{renderIcons()}</div>
      <div className="viz-comparison">
        <p>{comparisonLabel}</p>
      </div>
    </div>
  )
}

function GoogleSearchComparison({ googleSearches }) {
  return (
    <div className="comparison-card">
      <div className="comparison-icon">
        <svg viewBox="0 0 24 24" width="32" height="32">
          <circle cx="12" cy="12" r="10" fill="#4285F4"/>
          <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">G</text>
        </svg>
      </div>
      <div className="comparison-text">
        <span className="comparison-value">{googleSearches.toFixed(1)}x</span>
        <span className="comparison-label">Google searches</span>
      </div>
    </div>
  )
}

function HistoryItem({ entry, onDelete }) {
  const date = new Date(entry.timestamp)
  const modelName = MODELS[entry.model]?.name || entry.model
  return (
    <div className="history-item">
      <div className="history-info">
        <span className="history-model">{modelName}</span>
        <span className="history-tokens">{entry.inputTokens.toLocaleString()} in / {entry.outputTokens.toLocaleString()} out</span>
        <span className="history-date">{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
      </div>
      <div className="history-impact">
        <span>{entry.impact.energyWh.toFixed(3)} Wh</span>
        <span>{entry.impact.waterMl.toFixed(1)} ml</span>
      </div>
      <button className="delete-btn" onClick={onDelete} title="Delete entry">x</button>
    </div>
  )
}

export default function App() {
  const [inputTokens, setInputTokens] = useState('')
  const [outputTokens, setOutputTokens] = useState('')
  const [selectedModel, setSelectedModel] = useState('claude-opus-4-5')
  const [currentImpact, setCurrentImpact] = useState(null)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('ai-cost-tracker-history')
    if (saved) {
      try {
        setHistory(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load history:', e)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('ai-cost-tracker-history', JSON.stringify(history))
  }, [history])

  const handleCalculate = (e) => {
    e.preventDefault()
    const inTokens = parseInt(inputTokens) || 0
    const outTokens = parseInt(outputTokens) || 0
    if (inTokens === 0 && outTokens === 0) return
    const impact = calculateImpact(inTokens, outTokens, selectedModel)
    setCurrentImpact(impact)
  }

  const handleAddToHistory = () => {
    if (!currentImpact) return
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      model: selectedModel,
      inputTokens: currentImpact.inputTokens,
      outputTokens: currentImpact.outputTokens,
      impact: currentImpact,
    }
    setHistory(prev => [entry, ...prev])
  }

  const handleDeleteEntry = (id) => {
    setHistory(prev => prev.filter(entry => entry.id !== id))
  }

  const handleClearHistory = () => {
    if (confirm('Clear all history?')) {
      setHistory([])
    }
  }

  const totalImpact = history.reduce((acc, entry) => ({
    energyWh: acc.energyWh + entry.impact.energyWh,
    waterMl: acc.waterMl + entry.impact.waterMl,
    tokens: acc.tokens + entry.impact.totalTokens,
  }), { energyWh: 0, waterMl: 0, tokens: 0 })

  return (
    <div className="app">
      <header>
        <h1>AI Environmental Cost Tracker</h1>
        <p className="subtitle">Visualize the water and electricity footprint of your AI usage</p>
      </header>

      <main>
        <form className="input-form" onSubmit={handleCalculate}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="model">Model</label>
              <select
                id="model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {Object.entries(MODELS).map(([key, model]) => (
                  <option key={key} value={key}>
                    {model.provider} - {model.name}
                    {model.isReasoning ? ' (High Energy)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="inputTokens">Input Tokens</label>
              <input
                type="number"
                id="inputTokens"
                value={inputTokens}
                onChange={(e) => setInputTokens(e.target.value)}
                placeholder="e.g., 5000"
                min="0"
              />
            </div>
            <div className="form-group">
              <label htmlFor="outputTokens">Output Tokens</label>
              <input
                type="number"
                id="outputTokens"
                value={outputTokens}
                onChange={(e) => setOutputTokens(e.target.value)}
                placeholder="e.g., 2000"
                min="0"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn primary">Calculate Impact</button>
            {currentImpact && (
              <button type="button" className="btn secondary" onClick={handleAddToHistory}>
                Add to History
              </button>
            )}
          </div>
        </form>

        {currentImpact && (
          <div className="results">
            <div className="results-header">
              <h2>Environmental Impact</h2>
              <p className="token-summary">
                {currentImpact.totalTokens.toLocaleString()} total tokens
                ({currentImpact.inputTokens.toLocaleString()} in + {currentImpact.outputTokens.toLocaleString()} out)
              </p>
            </div>

            <div className="visualizations">
              <WaterVisualization
                waterMl={currentImpact.waterMl}
                glassesOfWater={currentImpact.glassesOfWater}
                milkJugs={currentImpact.milkJugs}
              />
              <ElectricityVisualization
                energyWh={currentImpact.energyWh}
                smartphoneCharges={currentImpact.smartphoneCharges}
                ledBulbHours={currentImpact.ledBulbHours}
                laptopMinutes={currentImpact.laptopMinutes}
              />
            </div>

            <div className="comparisons">
              <GoogleSearchComparison googleSearches={currentImpact.googleSearches} />
            </div>
          </div>
        )}

        <div className="history-section">
          <div className="history-header">
            <button className="btn text" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Hide' : 'Show'} History ({history.length} entries)
            </button>
            {history.length > 0 && (
              <div className="history-totals">
                <span>Total: {totalImpact.tokens.toLocaleString()} tokens</span>
                <span>{totalImpact.energyWh.toFixed(2)} Wh</span>
                <span>{(totalImpact.waterMl / 1000).toFixed(2)} L water</span>
              </div>
            )}
          </div>

          {showHistory && history.length > 0 && (
            <div className="history-list">
              {history.map(entry => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  onDelete={() => handleDeleteEntry(entry.id)}
                />
              ))}
              <button className="btn danger" onClick={handleClearHistory}>
                Clear All History
              </button>
            </div>
          )}
        </div>

        <div className="methodology">
          <h3>About These Estimates</h3>
          <p>
            <strong>Important:</strong> Neither Anthropic nor OpenAI officially disclose per-token
            energy consumption. These estimates are based on academic research, pricing ratios,
            and third-party benchmarks. Use as rough approximations only.
          </p>
          <p>
            Claude models consistently rank highest in eco-efficiency benchmarks (Claude 3.7 Sonnet
            scored 0.886). GPT-5 uses approximately 8x more energy than GPT-4 per response.
            Reasoning models (o1, o3, o4) use significantly more compute due to chain-of-thought processing.
          </p>
          <details>
            <summary>Data Sources & Methodology</summary>
            <ul>
              <li>Jegham et al. 2025: "How Hungry is AI?" - LLM energy benchmarks</li>
              <li>Epoch AI: ChatGPT energy consumption analysis</li>
              <li>TokenPowerBench: Per-token power consumption metrics</li>
              <li>UC Riverside: AI water consumption research (2023)</li>
              <li>Pricing ratios used for models without published data</li>
              <li>Water: 1.8ml/Wh based on PUE and grid water footprint</li>
            </ul>
          </details>
        </div>
      </main>

      <footer>
        <p>
          Built to raise awareness about AI environmental footprint.
          {' '}<a href="https://tech.kevinhyde.com" target="_blank" rel="noopener">tech.kevinhyde.com</a>
        </p>
      </footer>
    </div>
  )
}
