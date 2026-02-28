import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Jumbotron } from '@effects/effects/jumbotron/Jumbotron.js';
import { ScoreboardScreen } from '@effects/effects/jumbotron/screens/Scoreboard.js';

/**
 * JumbotronPanel — Dedicated workbench panel for the dot matrix display.
 *
 * Unlike other effects, the jumbotron is persistent (not fire-and-forget),
 * so it gets its own panel with game state controls.
 */
export function JumbotronPanel() {
  const canvasRef = useRef(null);
  const jumbotronRef = useRef(null);

  const [gameState, setGameState] = useState({
    awayTeam: 'NYY',
    homeTeam: 'BOS',
    awayScore: 3,
    homeScore: 7,
    inning: 5,
    inningHalf: 'top',
    balls: 2,
    strikes: 1,
    outs: 1,
    bases: [true, false, true], // Runner on 1st and 3rd
  });

  const [displayOpts, setDisplayOpts] = useState({
    cols: 128,
    rows: 64,
    dotSize: 3,
    gap: 1,
    glowIntensity: 0.15,
  });

  // Initialize jumbotron
  useEffect(() => {
    if (!canvasRef.current) return;

    const jt = new Jumbotron(canvasRef.current, displayOpts);
    jt.addScreen(ScoreboardScreen);
    jt.switchTo('scoreboard');
    jt.updateGameState(gameState);
    jt.start();
    jumbotronRef.current = jt;

    return () => jt.stop();
  }, [displayOpts]);

  // Update game state when sliders change
  useEffect(() => {
    if (jumbotronRef.current) {
      jumbotronRef.current.updateGameState(gameState);
    }
  }, [gameState]);

  const updateState = useCallback((key, value) => {
    setGameState(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleBase = useCallback((index) => {
    setGameState(prev => {
      const bases = [...prev.bases];
      bases[index] = !bases[index];
      return { ...prev, bases };
    });
  }, []);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Canvas area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        padding: 20,
      }}>
        <div style={{ border: '2px solid #333', borderRadius: 4 }}>
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
      </div>

      {/* Controls */}
      <div style={{
        width: 280,
        borderLeft: '1px solid #333',
        overflow: 'auto',
        padding: 12,
      }}>
        <h3 style={sectionTitle}>Game State</h3>

        {/* Teams */}
        <ControlGroup label="Away Team">
          <input
            type="text"
            value={gameState.awayTeam}
            onChange={e => updateState('awayTeam', e.target.value)}
            style={textInput}
            maxLength={8}
          />
        </ControlGroup>
        <ControlGroup label="Home Team">
          <input
            type="text"
            value={gameState.homeTeam}
            onChange={e => updateState('homeTeam', e.target.value)}
            style={textInput}
            maxLength={8}
          />
        </ControlGroup>

        {/* Scores */}
        <div style={{ display: 'flex', gap: 8 }}>
          <ControlGroup label="Away Score">
            <input type="number" min={0} max={99} value={gameState.awayScore}
              onChange={e => updateState('awayScore', parseInt(e.target.value) || 0)}
              style={{ ...textInput, width: 60 }} />
          </ControlGroup>
          <ControlGroup label="Home Score">
            <input type="number" min={0} max={99} value={gameState.homeScore}
              onChange={e => updateState('homeScore', parseInt(e.target.value) || 0)}
              style={{ ...textInput, width: 60 }} />
          </ControlGroup>
        </div>

        {/* Inning */}
        <div style={{ display: 'flex', gap: 8 }}>
          <ControlGroup label="Inning">
            <input type="number" min={1} max={18} value={gameState.inning}
              onChange={e => updateState('inning', parseInt(e.target.value) || 1)}
              style={{ ...textInput, width: 60 }} />
          </ControlGroup>
          <ControlGroup label="Half">
            <select value={gameState.inningHalf}
              onChange={e => updateState('inningHalf', e.target.value)}
              style={selectInput}>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </ControlGroup>
        </div>

        {/* Count */}
        <h3 style={sectionTitle}>Count</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <ControlGroup label="Balls">
            <input type="range" min={0} max={3} value={gameState.balls}
              onChange={e => updateState('balls', parseInt(e.target.value))}
              style={slider} />
            <span style={valueLabel}>{gameState.balls}</span>
          </ControlGroup>
          <ControlGroup label="Strikes">
            <input type="range" min={0} max={2} value={gameState.strikes}
              onChange={e => updateState('strikes', parseInt(e.target.value))}
              style={slider} />
            <span style={valueLabel}>{gameState.strikes}</span>
          </ControlGroup>
          <ControlGroup label="Outs">
            <input type="range" min={0} max={2} value={gameState.outs}
              onChange={e => updateState('outs', parseInt(e.target.value))}
              style={slider} />
            <span style={valueLabel}>{gameState.outs}</span>
          </ControlGroup>
        </div>

        {/* Bases */}
        <h3 style={sectionTitle}>Bases</h3>
        <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
          {['1st', '2nd', '3rd'].map((label, i) => (
            <button
              key={i}
              onClick={() => toggleBase(i)}
              style={{
                ...baseBtn,
                background: gameState.bases[i] ? '#eab308' : '#333',
                color: gameState.bases[i] ? '#000' : '#888',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Display Settings */}
        <h3 style={{ ...sectionTitle, marginTop: 20 }}>Display</h3>
        <ControlGroup label={`Dot Size: ${displayOpts.dotSize}px`}>
          <input type="range" min={1} max={6} value={displayOpts.dotSize}
            onChange={e => setDisplayOpts(prev => ({ ...prev, dotSize: parseInt(e.target.value) }))}
            style={slider} />
        </ControlGroup>
        <ControlGroup label={`Gap: ${displayOpts.gap}px`}>
          <input type="range" min={0} max={3} value={displayOpts.gap}
            onChange={e => setDisplayOpts(prev => ({ ...prev, gap: parseInt(e.target.value) }))}
            style={slider} />
        </ControlGroup>
        <ControlGroup label={`Glow: ${displayOpts.glowIntensity}`}>
          <input type="range" min={0} max={0.4} step={0.05} value={displayOpts.glowIntensity}
            onChange={e => setDisplayOpts(prev => ({ ...prev, glowIntensity: parseFloat(e.target.value) }))}
            style={slider} />
        </ControlGroup>

        {/* Quick actions */}
        <h3 style={{ ...sectionTitle, marginTop: 20 }}>Quick Actions</h3>
        <button onClick={() => {
          updateState('awayScore', gameState.awayScore + 1);
        }} style={actionBtn}>+ Away Run</button>
        <button onClick={() => {
          updateState('homeScore', gameState.homeScore + 1);
        }} style={actionBtn}>+ Home Run</button>
        <button onClick={() => {
          updateState('outs', Math.min(gameState.outs + 1, 2));
        }} style={actionBtn}>+ Out</button>
        <button onClick={() => {
          setGameState({
            awayTeam: 'NYY', homeTeam: 'BOS',
            awayScore: 3, homeScore: 7,
            inning: 5, inningHalf: 'top',
            balls: 2, strikes: 1, outs: 1,
            bases: [true, false, true],
          });
        }} style={{ ...actionBtn, borderColor: '#666' }}>Reset</button>
      </div>
    </div>
  );
}

function ControlGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
    </div>
  );
}

const sectionTitle = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '1px', color: '#888', marginBottom: 8, marginTop: 4,
};
const textInput = {
  width: '100%', padding: '5px 8px', background: '#222',
  border: '1px solid #444', borderRadius: 4, color: '#e0e0e0', fontSize: 12,
};
const selectInput = {
  ...textInput, width: 80,
};
const slider = { flex: 1, accentColor: '#4ade80' };
const valueLabel = { fontSize: 12, color: '#4ade80', fontFamily: 'monospace', minWidth: 16 };
const baseBtn = {
  flex: 1, padding: '6px', border: '1px solid #555', borderRadius: 4,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
};
const actionBtn = {
  display: 'block', width: '100%', padding: '6px 10px', marginBottom: 4,
  background: '#1a2a1a', border: '1px solid #4ade80', borderRadius: 4,
  color: '#4ade80', fontSize: 12, cursor: 'pointer',
};
