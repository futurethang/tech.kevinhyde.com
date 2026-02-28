import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEffects } from '@effects/core/GameEffects.js';
import { JumbotronPanel } from './JumbotronPanel.jsx';

// Import all effects here — this is the workbench registry
import { UmpireCall } from '@effects/effects/umpire-call/UmpireCall.js';
import { BatSwing } from '@effects/effects/bat-swing/BatSwing.js';

// Register effects
GameEffects.register(UmpireCall);
GameEffects.register(BatSwing);

// Workbench modes
const MODES = {
  EFFECTS: 'effects',
  JUMBOTRON: 'jumbotron',
};

export function WorkbenchApp() {
  const [mode, setMode] = useState(MODES.EFFECTS);
  const [effects, setEffects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [params, setParams] = useState({});
  const [lastDuration, setLastDuration] = useState(null);
  const [log, setLog] = useState([]);
  const [globalToggles, setGlobalToggles] = useState({ animations: true, sound: true, haptics: true });
  const viewportRef = useRef(null);

  useEffect(() => {
    GameEffects.init().then(() => {
      const list = GameEffects.getEffectList();
      setEffects(list);
      if (list.length > 0) {
        selectEffect(list[0].id, list[0].params);
      }
    });
  }, []);

  const selectEffect = useCallback((id, paramDefs) => {
    setSelectedId(id);
    // Initialize params to defaults
    const defaults = {};
    for (const [key, config] of Object.entries(paramDefs || {})) {
      defaults[key] = config.default;
    }
    setParams(defaults);
    setLastDuration(null);
  }, []);

  const addLog = useCallback((msg) => {
    setLog(prev => [...prev.slice(-19), { time: new Date().toLocaleTimeString(), msg }]);
  }, []);

  const playEffect = useCallback(async (overrideParams = {}) => {
    if (!selectedId || !viewportRef.current) return;
    const mergedParams = { ...params, ...overrideParams };
    addLog(`Playing "${selectedId}" with ${JSON.stringify(mergedParams)}`);

    const start = performance.now();
    try {
      await GameEffects.play(selectedId, viewportRef.current, mergedParams);
      const dur = performance.now() - start;
      setLastDuration(dur);
      addLog(`Completed in ${dur.toFixed(0)}ms`);
    } catch (e) {
      addLog(`Error: ${e.message}`);
    }
  }, [selectedId, params, addLog]);

  const toggleGlobal = (channel) => {
    const newState = GameEffects.toggle(channel);
    setGlobalToggles({ ...newState });
  };

  const selectedEffect = effects.find(e => e.id === selectedId);

  return (
    <div style={styles.shell}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={styles.title}>Effects Workbench</h1>
          <div style={styles.modeTabs}>
            <button
              onClick={() => setMode(MODES.EFFECTS)}
              style={{
                ...styles.modeTab,
                ...(mode === MODES.EFFECTS ? styles.modeTabActive : {}),
              }}
            >
              Effects
            </button>
            <button
              onClick={() => setMode(MODES.JUMBOTRON)}
              style={{
                ...styles.modeTab,
                ...(mode === MODES.JUMBOTRON ? styles.modeTabActive : {}),
              }}
            >
              Jumbotron
            </button>
          </div>
        </div>
        <div style={styles.toggleBar}>
          {['animations', 'sound', 'haptics'].map(ch => (
            <button
              key={ch}
              onClick={() => toggleGlobal(ch)}
              style={{
                ...styles.toggleBtn,
                opacity: globalToggles[ch] ? 1 : 0.4,
              }}
            >
              {ch === 'animations' ? '🎬' : ch === 'sound' ? '🔊' : '📳'}
              {' '}{ch}
            </button>
          ))}
        </div>
      </div>

      {/* Jumbotron mode */}
      {mode === MODES.JUMBOTRON && <JumbotronPanel />}

      {/* Effects mode */}
      {mode === MODES.EFFECTS && <div style={styles.body}>
        {/* Sidebar — Effect List */}
        <div style={styles.sidebar}>
          <h3 style={styles.sectionTitle}>Effects</h3>
          {effects.map(e => (
            <button
              key={e.id}
              onClick={() => selectEffect(e.id, e.params)}
              style={{
                ...styles.effectBtn,
                background: e.id === selectedId ? '#2a5a3a' : 'transparent',
                borderLeft: e.id === selectedId ? '3px solid #4ade80' : '3px solid transparent',
              }}
            >
              <div style={styles.effectName}>{e.name}</div>
              <div style={styles.effectDesc}>{e.description}</div>
            </button>
          ))}

          <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid #333' }}>
            <h3 style={styles.sectionTitle}>Console</h3>
            <div style={styles.consoleArea}>
              {log.map((entry, i) => (
                <div key={i} style={styles.logLine}>
                  <span style={styles.logTime}>{entry.time}</span> {entry.msg}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center — Phone Viewport */}
        <div style={styles.viewportArea}>
          <div style={styles.phoneFrame}>
            <div style={styles.phoneNotch} />
            <div
              ref={viewportRef}
              style={styles.viewport}
              id="effect-viewport"
            >
              <div style={styles.viewportPlaceholder}>
                {selectedId ? `"${selectedEffect?.name}" ready` : 'Select an effect'}
              </div>
            </div>
          </div>
          {lastDuration !== null && (
            <div style={styles.timing}>
              Duration: {lastDuration.toFixed(0)}ms ({(lastDuration / 1000).toFixed(2)}s)
            </div>
          )}
        </div>

        {/* Right Panel — Controls */}
        <div style={styles.controls}>
          <h3 style={styles.sectionTitle}>Triggers</h3>
          <button onClick={() => playEffect()} style={styles.playBtn}>
            ▶ Play
          </button>

          {selectedEffect && (
            <>
              <h3 style={{ ...styles.sectionTitle, marginTop: 20 }}>Parameters</h3>
              {Object.entries(selectedEffect.params).map(([key, config]) => (
                <ParamControl
                  key={key}
                  name={key}
                  config={config}
                  value={params[key]}
                  onChange={(val) => setParams(prev => ({ ...prev, [key]: val }))}
                />
              ))}
            </>
          )}
        </div>
      </div>}
    </div>
  );
}

/**
 * Generic parameter control — renders the right input type
 * based on the param config from the effect's static params.
 */
function ParamControl({ name, config, value, onChange }) {
  const label = name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

  if (config.type === 'range') {
    return (
      <div style={styles.paramGroup}>
        <label style={styles.paramLabel}>
          {label}: <span style={styles.paramValue}>{value}{config.unit || ''}</span>
        </label>
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step || 1}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={styles.slider}
        />
      </div>
    );
  }

  if (config.type === 'select') {
    return (
      <div style={styles.paramGroup}>
        <label style={styles.paramLabel}>{label}</label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={styles.select}
        >
          {config.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (config.type === 'text') {
    return (
      <div style={styles.paramGroup}>
        <label style={styles.paramLabel}>{label}</label>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={styles.textInput}
        />
      </div>
    );
  }

  if (config.type === 'toggle') {
    return (
      <div style={styles.paramGroup}>
        <label style={styles.paramLabel}>
          <input
            type="checkbox"
            checked={value}
            onChange={e => onChange(e.target.checked)}
          />
          {' '}{label}
        </label>
      </div>
    );
  }

  return null;
}

// ============================================================
// Styles
// ============================================================
const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#111',
    color: '#e0e0e0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid #333',
    background: '#1a1a1a',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#4ade80',
    letterSpacing: '0.5px',
  },
  modeTabs: {
    display: 'flex',
    gap: 2,
    background: '#222',
    borderRadius: 6,
    padding: 2,
  },
  modeTab: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modeTabActive: {
    background: '#2a5a3a',
    color: '#4ade80',
  },
  toggleBar: {
    display: 'flex',
    gap: 8,
  },
  toggleBtn: {
    background: 'none',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#e0e0e0',
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: 240,
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#888',
    padding: '12px 12px 6px',
  },
  effectBtn: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    color: '#e0e0e0',
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  effectName: {
    fontSize: 13,
    fontWeight: 500,
  },
  effectDesc: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  viewportArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    background: '#0a0a0a',
  },
  phoneFrame: {
    width: 280,
    height: 600,
    border: '3px solid #444',
    borderRadius: 32,
    overflow: 'hidden',
    background: '#1a472a',
    position: 'relative',
    boxShadow: '0 0 40px rgba(0,0,0,0.5)',
  },
  phoneNotch: {
    width: 100,
    height: 20,
    background: '#444',
    borderRadius: '0 0 12px 12px',
    margin: '0 auto',
  },
  viewport: {
    position: 'relative',
    width: '100%',
    height: 'calc(100% - 20px)',
    overflow: 'hidden',
  },
  viewportPlaceholder: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#4a7a5a',
    fontSize: 14,
    textAlign: 'center',
    pointerEvents: 'none',
  },
  timing: {
    marginTop: 12,
    fontSize: 12,
    color: '#888',
    fontFamily: 'monospace',
  },
  controls: {
    width: 260,
    borderLeft: '1px solid #333',
    padding: '0',
    overflow: 'auto',
  },
  playBtn: {
    display: 'block',
    width: 'calc(100% - 24px)',
    margin: '6px 12px',
    padding: '10px',
    background: '#2a5a3a',
    border: '1px solid #4ade80',
    borderRadius: 6,
    color: '#4ade80',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  paramGroup: {
    padding: '6px 12px',
  },
  paramLabel: {
    display: 'block',
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
  paramValue: {
    color: '#4ade80',
    fontFamily: 'monospace',
  },
  slider: {
    width: '100%',
    accentColor: '#4ade80',
  },
  select: {
    width: '100%',
    padding: '6px 8px',
    background: '#222',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#e0e0e0',
    fontSize: 12,
  },
  textInput: {
    width: '100%',
    padding: '6px 8px',
    background: '#222',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#e0e0e0',
    fontSize: 12,
  },
  consoleArea: {
    maxHeight: 200,
    overflow: 'auto',
    fontSize: 10,
    fontFamily: 'monospace',
    padding: '0 12px',
    lineHeight: 1.6,
  },
  logLine: {
    color: '#888',
  },
  logTime: {
    color: '#555',
  },
};
