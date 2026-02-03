/**
 * Players Page - MLB Player Database browser
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, Select, SearchInput } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import * as api from '../services/api';
import type { MLBPlayer } from '../types';

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

const SORT_OPTIONS = [
  { value: 'ops', label: 'OPS (High→Low)' },
  { value: 'avg', label: 'AVG (High→Low)' },
  { value: 'hr', label: 'HR (High→Low)' },
  { value: 'rbi', label: 'RBI (High→Low)' },
  { value: 'era', label: 'ERA (Low→High)' },
  { value: 'name', label: 'Name (A→Z)' },
];

export function Players() {
  const [players, setPlayers] = useState<MLBPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [sort, setSort] = useState('ops');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadPlayers(true);
  }, [search, position, sort]);

  async function loadPlayers(reset = false) {
    const currentPage = reset ? 1 : page;
    if (reset) setPage(1);
    setLoading(true);

    try {
      const result = await api.getPlayers({
        search: search || undefined,
        position: position || undefined,
        sort,
        page: currentPage,
        limit: 20,
      });

      if (reset) {
        setPlayers(result.players || []);
      } else {
        setPlayers((prev) => [...prev, ...(result.players || [])]);
      }
      // Calculate hasMore: if we got a full page and there are more records
      const currentOffset = result.offset || 0;
      const currentLimit = result.limit || 20;
      setHasMore(result.players && result.players.length === currentLimit && result.total > currentOffset + currentLimit);
    } catch (error) {
      console.error('Failed to load players:', error);
      // On error, ensure players is always an array
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header title="PLAYER DATABASE" showBack />

      <PageContainer>
        {/* Search and Filters */}
        <div className="space-y-3 mb-6">
          <SearchInput
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
          <div className="flex gap-3">
            <Select
              options={POSITIONS}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="flex-1"
            />
            <Select
              options={SORT_OPTIONS}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="flex-1"
            />
          </div>
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
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-gray-400 mb-2">No players found</p>
            <p className="text-sm text-gray-500">
              Try a different search or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player) => (
              <PlayerCard key={player.mlbId} player={player} />
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-3 text-center text-gray-400 hover:text-white transition-colors"
              >
                {loading ? 'Loading...' : 'Load more...'}
              </button>
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function PlayerCard({ player }: { player: MLBPlayer }) {
  const isPitcher = player.primaryPosition === 'SP' || player.primaryPosition === 'RP';

  return (
    <Card variant="interactive">
      <CardContent>
        <div className="flex items-start gap-3">
          {/* Photo placeholder - use actual photo if available */}
          {player.photoUrl ? (
            <img 
              src={player.photoUrl} 
              alt={player.fullName}
              className="w-16 h-16 rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className="w-16 h-16 rounded-lg bg-gray-700 flex items-center justify-center text-2xl shrink-0" style={{ display: player.photoUrl ? 'none' : 'flex' }}>
            ⚾
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white truncate">{player.fullName}</h3>
              <span className="text-sm font-medium text-green-400 ml-2">{player.primaryPosition}</span>
            </div>
            <p className="text-sm text-gray-400">{player.currentTeam} • {player.seasonYear || '2024'}</p>

            {isPitcher && player.pitchingStats ? (
              <div className="mt-3">
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-white font-mono text-lg">
                      {player.pitchingStats.era.toFixed(2)}
                    </span>
                    <span className="text-gray-400 ml-1">ERA</span>
                  </div>
                  <div>
                    <span className="text-white font-mono text-lg">
                      {player.pitchingStats.whip.toFixed(2)}
                    </span>
                    <span className="text-gray-400 ml-1">WHIP</span>
                  </div>
                  <div>
                    <span className="text-white font-mono text-lg">
                      {player.pitchingStats.kPer9.toFixed(1)}
                    </span>
                    <span className="text-gray-400 ml-1">K/9</span>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
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
                    <span className="text-white font-mono text-lg">
                      {player.battingStats.avg.toFixed(3).substring(1)}
                    </span>
                    <span className="text-gray-400 ml-1">AVG</span>
                  </div>
                  <div>
                    <span className="text-white font-mono text-lg">
                      {player.battingStats.obp.toFixed(3).substring(1)}
                    </span>
                    <span className="text-gray-400 ml-1">OBP</span>
                  </div>
                  <div>
                    <span className="text-white font-mono text-lg">
                      {player.battingStats.ops.toFixed(3)}
                    </span>
                    <span className="text-gray-400 ml-1">OPS</span>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
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
          <div className="w-16 h-16 rounded-lg bg-gray-700" />
          <div className="flex-1">
            <div className="h-5 bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-3" />
            <div className="flex gap-4">
              <div className="h-4 bg-gray-700 rounded w-16" />
              <div className="h-4 bg-gray-700 rounded w-16" />
              <div className="h-4 bg-gray-700 rounded w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
