/**
 * Players Page - MLB Player Database browser
 * v5 Topps design: navy palette, gold accents, token colors
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, Select, SearchInput, PlayerDetailModal, Input, Button } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import * as api from '../services/api';
import type { MLBPlayer } from '../types';
import { TEAM_OPTIONS, LEAGUE_OPTIONS, getTeamByAbbreviation } from '../constants/mlb';

const POSITIONS = [
  { value: '', label: 'All Positions' },
  { value: 'C', label: 'C - Catcher' },
  { value: '1B', label: '1B - First Base' },
  { value: '2B', label: '2B - Second Base' },
  { value: '3B', label: '3B - Third Base' },
  { value: 'SS', label: 'SS - Shortstop' },
  { value: 'LF', label: 'LF - Left Field' },
  { value: 'CF', label: 'CF - Center Field' },
  { value: 'RF', label: 'RF - Right Field' },
  { value: 'DH', label: 'DH - Designated Hitter' },
  { value: 'SP', label: 'SP - Starting Pitcher' },
];

interface StatsFilters {
  minOps: string;
  maxOps: string;
  minEra: string;
  maxEra: string;
  minHr: string;
  maxHr: string;
  minRbi: string;
  maxRbi: string;
}

const SORT_OPTIONS = [
  { value: 'ops', label: 'OPS (High\u2192Low)' },
  { value: 'avg', label: 'AVG (High\u2192Low)' },
  { value: 'hr', label: 'HR (High\u2192Low)' },
  { value: 'rbi', label: 'RBI (High\u2192Low)' },
  { value: 'era', label: 'ERA (Low\u2192High)' },
  { value: 'name', label: 'Name (A\u2192Z)' },
];

function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function Players() {
  const [players, setPlayers] = useState<MLBPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [team, setTeam] = useState('');
  const [league, setLeague] = useState('');
  const [sort, setSort] = useState('ops');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<MLBPlayer | null>(null);
  const [statsFilters, setStatsFilters] = useState<StatsFilters>({
    minOps: '',
    maxOps: '',
    minEra: '',
    maxEra: '',
    minHr: '',
    maxHr: '',
    minRbi: '',
    maxRbi: '',
  });

  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => {
    loadPlayers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, position, team, league, sort, statsFilters]);

  async function loadPlayers(reset = false) {
    const currentPage = reset ? 1 : page;
    if (reset) setPage(1);
    setLoading(true);

    try {
      const result = await api.getPlayers({
        search: debouncedSearch || undefined,
        position: position || undefined,
        team: team || undefined,
        league: league || undefined,
        sort,
        page: currentPage,
        limit: 20,
        minOps: statsFilters.minOps ? parseFloat(statsFilters.minOps) : undefined,
        maxOps: statsFilters.maxOps ? parseFloat(statsFilters.maxOps) : undefined,
        minEra: statsFilters.minEra ? parseFloat(statsFilters.minEra) : undefined,
        maxEra: statsFilters.maxEra ? parseFloat(statsFilters.maxEra) : undefined,
        minHr: statsFilters.minHr ? parseInt(statsFilters.minHr) : undefined,
        maxHr: statsFilters.maxHr ? parseInt(statsFilters.maxHr) : undefined,
        minRbi: statsFilters.minRbi ? parseInt(statsFilters.minRbi) : undefined,
        maxRbi: statsFilters.maxRbi ? parseInt(statsFilters.maxRbi) : undefined,
      });

      if (reset) {
        setPlayers(result.players || []);
      } else {
        setPlayers((prev) => [...prev, ...(result.players || [])]);
      }
      const currentOffset = result.offset || 0;
      const currentLimit = result.limit || 20;
      setHasMore(result.players && result.players.length === currentLimit && result.total > currentOffset + currentLimit);
    } catch (error) {
      console.error('Failed to load players:', error);
      if (reset) {
        setPlayers([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  function loadMore() {
    setPage((p) => p + 1);
    loadPlayers(false);
  }

  function handleStatsFilterChange(key: keyof StatsFilters, value: string) {
    setStatsFilters(prev => ({ ...prev, [key]: value }));
  }

  function clearAllFilters() {
    setSearch('');
    setPosition('');
    setTeam('');
    setLeague('');
    setStatsFilters({
      minOps: '',
      maxOps: '',
      minEra: '',
      maxEra: '',
      minHr: '',
      maxHr: '',
      minRbi: '',
      maxRbi: '',
    });
  }

  function handlePlayerClick(player: MLBPlayer) {
    setSelectedPlayer(player);
  }

  function handleAddToTeam(player: MLBPlayer) {
    console.log('Add to team:', player.fullName);
    setSelectedPlayer(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
      <Header title="PLAYER DATABASE" showBack />

      <PageContainer>
        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <SearchInput
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />

          {/* Main Filters Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              options={POSITIONS}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
            <Select
              options={TEAM_OPTIONS}
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            />
            <Select
              options={LEAGUE_OPTIONS}
              value={league}
              onChange={(e) => setLeague(e.target.value)}
            />
            <Select
              options={SORT_OPTIONS}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm"
            >
              {showFilters ? 'Hide' : 'Show'} Stats Filters
              <svg
                className={`ml-2 h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>

            {(search || position || team || league || Object.values(statsFilters).some(v => v)) && (
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                className="text-sm text-[var(--color-card-red)]"
              >
                Clear All Filters
              </Button>
            )}
          </div>

          {/* Advanced Stats Filters */}
          {showFilters && (
            <Card>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 font-display ink-bleed">Stats Range Filters</h3>

                  {/* Batting Stats */}
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide font-display">Batting Stats</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-[var(--color-text-dim)] mb-1">Min OPS</label>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="0.700"
                          value={statsFilters.minOps}
                          onChange={(e) => handleStatsFilterChange('minOps', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-dim)] mb-1">Max OPS</label>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="1.200"
                          value={statsFilters.maxOps}
                          onChange={(e) => handleStatsFilterChange('maxOps', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-dim)] mb-1">Min HR</label>
                        <Input
                          type="number"
                          placeholder="20"
                          value={statsFilters.minHr}
                          onChange={(e) => handleStatsFilterChange('minHr', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-dim)] mb-1">Min RBI</label>
                        <Input
                          type="number"
                          placeholder="80"
                          value={statsFilters.minRbi}
                          onChange={(e) => handleStatsFilterChange('minRbi', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pitching Stats */}
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide font-display">Pitching Stats</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-[var(--color-text-dim)] mb-1">Min ERA</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="2.50"
                          value={statsFilters.minEra}
                          onChange={(e) => handleStatsFilterChange('minEra', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-dim)] mb-1">Max ERA</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="4.00"
                          value={statsFilters.maxEra}
                          onChange={(e) => handleStatsFilterChange('maxEra', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Player List */}
        {loading && players.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <PlayerCardSkeleton key={i} />
            ))}
          </div>
        ) : !players || players.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">&#x1F50D;</div>
            <p className="text-[var(--color-text-muted)] mb-2">No players found</p>
            <p className="text-sm text-[var(--color-text-dim)]">
              Try a different search or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player) => (
              <PlayerCard key={player.mlbId} player={player} onClick={() => handlePlayerClick(player)} />
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-3 text-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {loading ? 'Loading...' : 'Load more...'}
              </button>
            )}
          </div>
        )}
      </PageContainer>

      {/* Player Detail Modal */}
      <PlayerDetailModal
        player={selectedPlayer}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        onAddToTeam={handleAddToTeam}
      />
    </div>
  );
}

function PlayerCard({ player, onClick }: { player: MLBPlayer; onClick: () => void }) {
  const isPitcher = player.primaryPosition === 'SP' || player.primaryPosition === 'RP';
  const team = getTeamByAbbreviation(player.currentTeam);

  return (
    <Card variant="interactive" className="cursor-pointer" onClick={onClick}>
      <CardContent>
        <div className="flex items-start gap-3">
          {player.photoUrl ? (
            <img
              src={player.photoUrl}
              alt={player.fullName}
              className="w-16 h-16 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const nextEl = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (nextEl) nextEl.style.display = 'flex';
              }}
            />
          ) : null}
          <div className="w-16 h-16 bg-[var(--color-surface-hover)] flex items-center justify-center text-2xl shrink-0" style={{ display: player.photoUrl ? 'none' : 'flex' }}>
            &#x26BE;
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-text-primary)] truncate hover:text-[var(--color-topps-gold)] transition-colors font-display">{player.fullName}</h3>
              <span className="text-sm font-medium text-[var(--color-topps-gold)] ml-2 font-display">{player.primaryPosition}</span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {team ? `${team.city} ${team.name}` : player.currentTeam} &bull; {player.seasonYear || '2024'}
            </p>

            {isPitcher && player.pitchingStats ? (
              <div className="mt-3">
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-[var(--color-text-primary)] font-mono text-lg">
                      {player.pitchingStats.era.toFixed(2)}
                    </span>
                    <span className="text-[var(--color-text-muted)] ml-1">ERA</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-primary)] font-mono text-lg">
                      {player.pitchingStats.whip.toFixed(2)}
                    </span>
                    <span className="text-[var(--color-text-muted)] ml-1">WHIP</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-primary)] font-mono text-lg">
                      {player.pitchingStats.kPer9.toFixed(1)}
                    </span>
                    <span className="text-[var(--color-text-muted)] ml-1">K/9</span>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-dim)]">
                  <span>{player.pitchingStats.wins}-{player.pitchingStats.losses} W-L</span>
                  <span>{player.pitchingStats.strikeouts} K</span>
                  <span>{player.pitchingStats.inningsPitched.toFixed(1)} IP</span>
                  <span>{player.pitchingStats.gamesStarted || player.pitchingStats.gamesPlayed} GS</span>
                </div>
              </div>
            ) : player.battingStats ? (
              <div className="mt-3">
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-[var(--color-text-primary)] font-mono text-lg">
                      {player.battingStats.avg.toFixed(3).substring(1)}
                    </span>
                    <span className="text-[var(--color-text-muted)] ml-1">AVG</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-primary)] font-mono text-lg">
                      {player.battingStats.obp.toFixed(3).substring(1)}
                    </span>
                    <span className="text-[var(--color-text-muted)] ml-1">OBP</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-primary)] font-mono text-lg">
                      {player.battingStats.ops.toFixed(3)}
                    </span>
                    <span className="text-[var(--color-text-muted)] ml-1">OPS</span>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-dim)]">
                  <span>{player.battingStats.homeRuns} HR</span>
                  <span>{player.battingStats.rbi} RBI</span>
                  <span>{player.battingStats.runs} R</span>
                  <span>{player.battingStats.hits} H</span>
                  <span>{player.battingStats.stolenBases || 0} SB</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent>
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 bg-[var(--color-surface-hover)]" />
          <div className="flex-1">
            <div className="h-5 bg-[var(--color-surface-hover)] w-3/4 mb-2" />
            <div className="h-4 bg-[var(--color-surface-hover)] w-1/2 mb-3" />
            <div className="flex gap-4">
              <div className="h-4 bg-[var(--color-surface-hover)] w-16" />
              <div className="h-4 bg-[var(--color-surface-hover)] w-16" />
              <div className="h-4 bg-[var(--color-surface-hover)] w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
