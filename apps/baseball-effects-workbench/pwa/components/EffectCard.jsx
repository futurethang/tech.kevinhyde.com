import React from 'react';

export function EffectCard({ effect, onPlay }) {
  return (
    <button style={styles.card} onClick={onPlay}>
      <div style={styles.name}>{effect.name}</div>
      <div style={styles.desc}>{effect.description}</div>
      <div style={styles.playIcon}>&#9654;</div>
    </button>
  );
}

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: 16,
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 12,
    color: '#e0e0e0',
    cursor: 'pointer',
    textAlign: 'left',
    position: 'relative',
    transition: 'background 0.15s',
    minHeight: 100,
  },
  name: {
    fontSize: 15,
    fontWeight: 600,
    color: '#4ade80',
  },
  desc: {
    fontSize: 12,
    color: '#888',
    lineHeight: 1.4,
    flex: 1,
  },
  playIcon: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    fontSize: 18,
    color: '#4ade80',
    opacity: 0.6,
  },
};
