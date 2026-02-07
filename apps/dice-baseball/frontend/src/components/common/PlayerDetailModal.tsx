/**
 * PlayerDetailModal - Detailed player view with stats and comparison
 */

import { useState, useEffect } from 'react';
import type { MLBPlayer } from '../../types';
import { Card, CardContent, Button } from './index';
import * as api from '../../services/api';
import { getTeamByAbbreviation } from '../../constants/mlb';

interface PlayerDetailModalProps {
  player: MLBPlayer | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToTeam?: (player: MLBPlayer) => void;
}

interface ComparisonPlayer {
  player: MLBPlayer | null;
  loading: boolean;
}

export function PlayerDetailModal({ player, isOpen, onClose, onAddToTeam }: PlayerDetailModalProps) {
  const [comparePlayer, setComparePlayer] = useState<ComparisonPlayer>({ player: null, loading: false });
  const [showComparison, setShowComparison] = useState(false);
  const [searchResults, setSearchResults] = useState<MLBPlayer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowComparison(false);
      setComparePlayer({ player: null, loading: false });
      setSearchResults([]);
    }
  }, [isOpen]);

  const isPitcher = player?.primaryPosition === 'SP' || player?.primaryPosition === 'RP';
  const compareIsPitcher = comparePlayer.player?.primaryPosition === 'SP' || comparePlayer.player?.primaryPosition === 'RP';

  async function searchPlayersForComparison(search: string) {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const result = await api.getPlayers({
        search,
        position: player?.primaryPosition, // Same position only
        limit: 10,
      });
      setSearchResults(result.players?.filter(p => p.mlbId !== player?.mlbId) || []);
    } catch (error) {
      console.error('Failed to search players:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function loadComparePlayer(mlbId: number) {
    setComparePlayer({ player: null, loading: true });
    try {
      const playerData = await api.getPlayerById(mlbId);
      setComparePlayer({ player: playerData, loading: false });
      setShowComparison(true);
    } catch (error) {
      console.error('Failed to load comparison player:', error);
      setComparePlayer({ player: null, loading: false });
    }
  }

  if (!isOpen || !player) return null;

  const team = getTeamByAbbreviation(player.currentTeam);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <Card padding="none">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {player.photoUrl ? (
                  <img 
                    src={player.photoUrl} 
                    alt={player.fullName}
                    className="w-20 h-20 rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const nextEl = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (nextEl) nextEl.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="w-20 h-20 rounded-lg bg-gray-700 flex items-center justify-center text-3xl shrink-0" style={{ display: player.photoUrl ? 'none' : 'flex' }}>
                  ⚾
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-white">{player.fullName}</h2>
                  <p className="text-gray-400">
                    {player.primaryPosition} • {team ? `${team.city} ${team.name}` : player.currentTeam} • {player.seasonYear || '2024'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!showComparison && (
                  <Button 
                    variant="secondary" 
                    onClick={() => setShowComparison(true)}
                    className="hidden sm:inline-flex"
                  >
                    Compare
                  </Button>
                )}
                {onAddToTeam && (
                  <Button 
                    onClick={() => onAddToTeam(player)}
                    className="hidden sm:inline-flex"
                  >
                    Add to Team
                  </Button>
                )}
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>
          
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Comparison Search */}
              {showComparison && !comparePlayer.player && (
                <div className="border-b border-gray-700 pb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Compare with another {player.primaryPosition}</h3>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={`Search for ${player.primaryPosition} players...`}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      onChange={(e) => searchPlayersForComparison(e.target.value)}
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-3.5">
                        <div className="animate-spin w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {searchResults.map(p => (
                        <button
                          key={p.mlbId}
                          onClick={() => loadComparePlayer(p.mlbId)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-white transition-colors"
                        >
                          <div className="font-medium">{p.fullName}</div>
                          <div className="text-sm text-gray-400">{p.currentTeam}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stats Display */}
              <div className={`grid gap-6 ${showComparison && comparePlayer.player ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Primary Player Stats */}
                <div>
                  {showComparison && <h3 className="text-lg font-semibold text-white mb-4">{player.fullName}</h3>}
                  {isPitcher ? (
                    <PitchingStatsDisplay player={player} />
                  ) : (
                    <BattingStatsDisplay player={player} />
                  )}
                </div>

                {/* Comparison Player Stats */}
                {showComparison && comparePlayer.loading && (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
                  </div>
                )}

                {showComparison && comparePlayer.player && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">{comparePlayer.player.fullName}</h3>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setComparePlayer({ player: null, loading: false })}
                      >
                        Remove
                      </Button>
                    </div>
                    {compareIsPitcher ? (
                      <PitchingStatsDisplay player={comparePlayer.player} />
                    ) : (
                      <BattingStatsDisplay player={comparePlayer.player} />
                    )}
                  </div>
                )}
              </div>

              {/* Mobile Action Buttons */}
              <div className="flex gap-3 sm:hidden">
                {!showComparison && (
                  <Button 
                    variant="secondary" 
                    onClick={() => setShowComparison(true)}
                    className="flex-1"
                  >
                    Compare
                  </Button>
                )}
                {onAddToTeam && (
                  <Button 
                    onClick={() => onAddToTeam(player)}
                    className="flex-1"
                  >
                    Add to Team
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BattingStatsDisplay({ player }: { player: MLBPlayer }) {
  const stats = player.battingStats;
  if (!stats) return <div className="text-gray-400">No batting stats available</div>;

  return (
    <div className="space-y-4">
      {/* Primary Stats */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Primary Stats</h4>
        <div className="grid grid-cols-3 gap-4">
          <StatItem label="AVG" value={stats.avg.toFixed(3).substring(1)} />
          <StatItem label="OBP" value={stats.obp.toFixed(3).substring(1)} />
          <StatItem label="SLG" value={stats.slg.toFixed(3).substring(1)} />
          <StatItem label="OPS" value={stats.ops.toFixed(3)} />
          <StatItem label="HR" value={stats.homeRuns.toString()} />
          <StatItem label="RBI" value={stats.rbi.toString()} />
        </div>
      </div>

      {/* Counting Stats */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Counting Stats</h4>
        <div className="grid grid-cols-3 gap-4">
          <StatItem label="Games" value={stats.gamesPlayed.toString()} />
          <StatItem label="At Bats" value={stats.atBats.toString()} />
          <StatItem label="Runs" value={stats.runs.toString()} />
          <StatItem label="Hits" value={stats.hits.toString()} />
          <StatItem label="Doubles" value={stats.doubles.toString()} />
          <StatItem label="Triples" value={stats.triples.toString()} />
          <StatItem label="Walks" value={stats.walks.toString()} />
          <StatItem label="Strikeouts" value={stats.strikeouts.toString()} />
          <StatItem label="Stolen Bases" value={stats.stolenBases.toString()} />
        </div>
      </div>
    </div>
  );
}

function PitchingStatsDisplay({ player }: { player: MLBPlayer }) {
  const stats = player.pitchingStats;
  if (!stats) return <div className="text-gray-400">No pitching stats available</div>;

  return (
    <div className="space-y-4">
      {/* Primary Stats */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Primary Stats</h4>
        <div className="grid grid-cols-3 gap-4">
          <StatItem label="ERA" value={stats.era.toFixed(2)} />
          <StatItem label="WHIP" value={stats.whip.toFixed(2)} />
          <StatItem label="K/9" value={stats.kPer9.toFixed(1)} />
          <StatItem label="BB/9" value={stats.bbPer9.toFixed(1)} />
          <StatItem label="HR/9" value={stats.hrPer9.toFixed(1)} />
          <StatItem label="W-L" value={`${stats.wins}-${stats.losses}`} />
        </div>
      </div>

      {/* Counting Stats */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Counting Stats</h4>
        <div className="grid grid-cols-3 gap-4">
          <StatItem label="Games" value={stats.gamesPlayed.toString()} />
          <StatItem label="Starts" value={stats.gamesStarted.toString()} />
          <StatItem label="Innings" value={stats.inningsPitched.toFixed(1)} />
          <StatItem label="Hits" value={stats.hits.toString()} />
          <StatItem label="Runs" value={stats.runs.toString()} />
          <StatItem label="Earned Runs" value={stats.earnedRuns.toString()} />
          <StatItem label="Home Runs" value={stats.homeRuns.toString()} />
          <StatItem label="Walks" value={stats.walks.toString()} />
          <StatItem label="Strikeouts" value={stats.strikeouts.toString()} />
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-mono font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}