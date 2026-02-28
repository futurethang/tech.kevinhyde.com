import React, { useRef, useEffect } from 'react';
import { Jumbotron } from '@effects/effects/jumbotron/Jumbotron.js';
import { ScoreboardScreen } from '@effects/effects/jumbotron/screens/Scoreboard.js';

const DEFAULT_STATE = {
  awayTeam: 'AWAY',
  homeTeam: 'HOME',
  awayScore: 0,
  homeScore: 0,
  inning: 1,
  inningHalf: 'top',
  balls: 0,
  strikes: 0,
  outs: 0,
  bases: { first: false, second: false, third: false },
};

export function MiniJumbotron() {
  const canvasRef = useRef(null);
  const jumbotronRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const jumbotron = new Jumbotron(canvasRef.current, {
      dotSize: 3,
      dotGap: 1,
      glowIntensity: 0.2,
    });

    jumbotron.addScreen(ScoreboardScreen);
    jumbotron.updateGameState(DEFAULT_STATE);
    jumbotron.switchTo('scoreboard');
    jumbotron.start();
    jumbotronRef.current = jumbotron;

    return () => {
      jumbotron.stop();
    };
  }, []);

  return (
    <div style={styles.container}>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        width={360}
        height={120}
      />
    </div>
  );
}

const styles = {
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #333',
    background: '#0a0a0a',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: 'auto',
    imageRendering: 'pixelated',
  },
};
