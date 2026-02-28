import React, { useState, useEffect, useCallback } from 'react';
import { GameEffects } from '@effects/core/GameEffects.js';
import { UmpireCall } from '@effects/effects/umpire-call/UmpireCall.js';
import { BatSwing } from '@effects/effects/bat-swing/BatSwing.js';
import { ToggleBar } from './components/ToggleBar.jsx';
import { EffectCard } from './components/EffectCard.jsx';
import { EffectViewport } from './components/EffectViewport.jsx';
import { MiniJumbotron } from './components/MiniJumbotron.jsx';

// Register effects
GameEffects.register(UmpireCall);
GameEffects.register(BatSwing);

export function App() {
  const [effects, setEffects] = useState([]);
  const [globalToggles, setGlobalToggles] = useState({ animations: true, sound: true, haptics: true });
  const [activeEffect, setActiveEffect] = useState(null);
  const [showJumbotron, setShowJumbotron] = useState(false);

  useEffect(() => {
    GameEffects.init().then(() => {
      setEffects(GameEffects.getEffectList());
    });
  }, []);

  const toggleChannel = useCallback((channel) => {
    const newState = GameEffects.toggle(channel);
    setGlobalToggles({ ...newState });
  }, []);

  const playEffect = useCallback((id) => {
    setActiveEffect(id);
  }, []);

  const dismissEffect = useCallback(() => {
    setActiveEffect(null);
  }, []);

  return (
    <div style={styles.shell}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.logo}>&#9918;</span>
          <h1 style={styles.title}>FX Tester</h1>
        </div>
        <ToggleBar toggles={globalToggles} onToggle={toggleChannel} />
      </div>

      {/* Effect Cards */}
      <div style={styles.content}>
        <div style={styles.grid}>
          {effects.map(effect => (
            <EffectCard
              key={effect.id}
              effect={effect}
              onPlay={() => playEffect(effect.id)}
            />
          ))}
        </div>

        {/* Jumbotron Toggle */}
        <button
          style={styles.jumbotronToggle}
          onClick={() => setShowJumbotron(prev => !prev)}
        >
          {showJumbotron ? 'Hide' : 'Show'} Jumbotron
        </button>

        {showJumbotron && <MiniJumbotron />}
      </div>

      {/* Full-screen effect viewport */}
      {activeEffect && (
        <EffectViewport
          effectId={activeEffect}
          onDismiss={dismissEffect}
        />
      )}
    </div>
  );
}

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#111',
    color: '#e0e0e0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    paddingTop: 'max(12px, env(safe-area-inset-top))',
    borderBottom: '1px solid #333',
    background: '#1a1a1a',
    flexShrink: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#4ade80',
    letterSpacing: '0.5px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  jumbotronToggle: {
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#888',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center',
  },
};
