import React from 'react';

const CHANNELS = [
  { key: 'animations', icon: '\uD83C\uDFAC', label: 'Anim' },
  { key: 'sound', icon: '\uD83D\uDD0A', label: 'Sound' },
  { key: 'haptics', icon: '\uD83D\uDCF3', label: 'Haptic' },
];

export function ToggleBar({ toggles, onToggle }) {
  return (
    <div style={styles.bar}>
      {CHANNELS.map(ch => (
        <button
          key={ch.key}
          onClick={() => onToggle(ch.key)}
          style={{
            ...styles.btn,
            opacity: toggles[ch.key] ? 1 : 0.35,
            borderColor: toggles[ch.key] ? '#4ade80' : '#444',
          }}
        >
          {ch.icon}
        </button>
      ))}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    gap: 6,
  },
  btn: {
    background: 'none',
    border: '1.5px solid #444',
    borderRadius: 6,
    color: '#e0e0e0',
    padding: '6px 10px',
    fontSize: 16,
    cursor: 'pointer',
    transition: 'opacity 0.15s, border-color 0.15s',
    lineHeight: 1,
  },
};
