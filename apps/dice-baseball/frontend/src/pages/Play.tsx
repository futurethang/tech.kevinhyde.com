/**
 * Play Page - Create or join a game
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, Input, Select } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { useTeamStore } from '../stores/teamStore';
import * as api from '../services/api';
import type { Game } from '../types';

export function Play() {
  const navigate = useNavigate();
  const { teams, setTeams } = useTeamStore();
  const [joinCode, setJoinCode] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWaiting, setShowWaiting] = useState(false);
  const [createdGame, setCreatedGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);

  // Get only complete teams
  const completeTeams = teams.filter((t) => t.rosterComplete);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (completeTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(completeTeams[0].id);
    }
  }, [completeTeams, selectedTeamId]);

  async function loadTeams() {
    try {
      const { teams } = await api.getTeams();
      setTeams(teams);
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  }

  async function handleCreateGame() {
    if (!selectedTeamId) {
      setError('Please select a team');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const game = await api.createGame(selectedTeamId);
      setCreatedGame(game);
      setShowWaiting(true);
      // Poll for opponent joining
      pollForOpponent(game.id);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  }

  async function pollForOpponent(gameId: string) {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const game = await api.getGameById(gameId);
        if (game.status === 'active') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          navigate(`/game/${gameId}`);
        }
      } catch {
        // Ignore errors during polling
      }
    }, 2000);

    // Stop polling after 5 minutes
    pollingTimeoutRef.current = setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollingTimeoutRef.current = null;
    }, 5 * 60 * 1000);
  }

  async function handleJoinGame() {
    if (!joinCode.trim()) {
      setError('Please enter a join code');
      return;
    }

    if (!selectedTeamId) {
      setError('Please select a team');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const game = await api.joinGame(joinCode.trim().toUpperCase(), selectedTeamId);
      navigate(`/game/${game.id}`);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to join game');
    } finally {
      setLoading(false);
    }
  }

  function copyJoinCode() {
    if (createdGame?.joinCode) {
      navigator.clipboard.writeText(createdGame.joinCode);
    }
  }

  if (showWaiting && createdGame) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <Header title="WAITING FOR OPPONENT" showBack />
        <PageContainer className="flex items-center justify-center">
          <Card className="text-center">
            <CardContent>
              <p className="text-gray-400 mb-4">Share this code with your opponent:</p>
              <div className="bg-gray-900 rounded-lg py-4 px-6 mb-4">
                <span
                  className="text-3xl font-mono font-bold text-white tracking-widest"
                  data-testid="play-created-join-code"
                >
                  {createdGame.joinCode}
                </span>
              </div>
              <div className="flex gap-3 justify-center mb-6">
                <Button size="sm" variant="secondary" onClick={copyJoinCode}>
                  📋 Copy Code
                </Button>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-green-500 rounded-full" />
                <span>Waiting for opponent...</span>
              </div>
              <Button
                variant="ghost"
                className="mt-6"
                onClick={() => {
                  if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                  }
                  if (pollingTimeoutRef.current) {
                    clearTimeout(pollingTimeoutRef.current);
                    pollingTimeoutRef.current = null;
                  }
                  setShowWaiting(false);
                  setCreatedGame(null);
                }}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header title="PLAY" showBack />

      <PageContainer>
        {completeTeams.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">⚾</div>
            <p className="text-gray-400 mb-4">No complete teams!</p>
            <p className="text-sm text-gray-500 mb-6">
              You need a team with a full roster to play.
            </p>
            <Button onClick={() => navigate('/teams')}>Build a Team</Button>
          </div>
        ) : (
          <>
            {/* Team Selection */}
            <div className="mb-6">
              <Select
                label="Select Your Team"
                options={completeTeams.map((t) => ({ value: t.id, label: t.name }))}
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                data-testid="play-team-select"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm">
                {error}
              </div>
            )}

            {/* Create Game */}
            <Card className="mb-4">
              <CardContent className="text-center py-6">
                <div className="text-3xl mb-2">🔗</div>
                <h3 className="text-lg font-semibold text-white mb-2">CREATE GAME</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Get a code to share with a friend
                </p>
                <Button onClick={handleCreateGame} isLoading={loading} data-testid="play-create-game">
                  Create Game
                </Button>
              </CardContent>
            </Card>

            {/* Join Game */}
            <Card>
              <CardContent className="text-center py-6">
                <div className="text-3xl mb-2">🎫</div>
                <h3 className="text-lg font-semibold text-white mb-4">JOIN WITH CODE</h3>
                <Input
                  placeholder="Enter 6-character code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  data-testid="play-join-code-input"
                  className="text-center text-xl tracking-widest font-mono mb-4"
                />
                <Button
                  onClick={handleJoinGame}
                  isLoading={loading}
                  disabled={!joinCode.trim()}
                  data-testid="play-join-game"
                >
                  Join Game
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </PageContainer>
    </div>
  );
}
