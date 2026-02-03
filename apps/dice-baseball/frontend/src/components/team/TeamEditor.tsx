/**
 * TeamEditor - Full team editing interface with roster management
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, Input, Select } from '../common';
import { Header, PageContainer } from '../layout/Header';
import { useTeamStore } from '../../stores/teamStore';
import * as api from '../../services/api';
import type { Team, MLBPlayer, RosterSlot, Position } from '../../types';

interface TeamEditorProps {
  teamId: string;
}

const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP'];
const POSITION_NAMES = {
  'C': 'Catcher',
  '1B': 'First Base',
  '2B': 'Second Base', 
  '3B': 'Third Base',
  'SS': 'Shortstop',
  'LF': 'Left Field',
  'CF': 'Center Field',
  'RF': 'Right Field',
  'DH': 'Designated Hitter',
  'SP': 'Starting Pitcher'
};

export function TeamEditor({ teamId }: TeamEditorProps) {
  const navigate = useNavigate();
  const { teams, setCurrentEditingTeam, updateTeam } = useTeamStore();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPosition, setSearchPosition] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MLBPlayer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showPlayerSearch, setShowPlayerSearch] = useState<Position | null>(null);
  const [populatedRoster, setPopulatedRoster] = useState<Record<string, MLBPlayer>>({});
  const [savingPosition, setSavingPosition] = useState<Position | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  async function loadTeam() {
    console.log('Loading team with ID:', teamId);
    setLoading(true);
    try {
      // Try local store first
      let teamData = teams.find(t => t.id === teamId);
      console.log('Team from local store:', teamData);
      
      if (!teamData) {
        console.log('Team not in local store, fetching from API...');
        // Fetch from API
        teamData = await api.getTeamById(teamId);
        console.log('Team from API:', teamData);
      }
      
      setTeam(teamData);
      setCurrentEditingTeam(teamData);
      
      // Populate roster with player data
      console.log('Populating roster data for:', teamData.roster?.length || 0, 'slots');
      await populateRosterData(teamData.roster || []);
    } catch (error) {
      console.error('Failed to load team:', error);
      navigate('/teams');
    } finally {
      setLoading(false);
    }
  }

  async function populateRosterData(roster: RosterSlot[]) {
    const playerIds = roster.map(slot => slot.mlbPlayerId).filter(Boolean);
    const populated: Record<string, MLBPlayer> = {};
    
    // Fetch each player's data
    for (const playerId of playerIds) {
      try {
        const player = await api.getPlayerById(playerId);
        populated[playerId.toString()] = player;
      } catch (error) {
        console.warn(`Failed to fetch player ${playerId}:`, error);
      }
    }
    
    setPopulatedRoster(populated);
  }

  async function searchPlayers() {
    if (!searchQuery.trim()) {
      // If no search query, reload position-filtered results
      if (showPlayerSearch) {
        await loadPlayersForPosition(showPlayerSearch);
      }
      return;
    }
    
    setSearchLoading(true);
    try {
      const params: any = { 
        search: searchQuery.trim(), 
        limit: 30,
        sort: showPlayerSearch === 'SP' ? 'era' : 'ops'
      };
      
      // Keep position filter when searching by name
      if (searchPosition) {
        params.position = searchPosition;
      }
      
      const { players } = await api.getPlayers(params);
      setSearchResults(players);
    } catch (error) {
      console.error('Failed to search players:', error);
    } finally {
      setSearchLoading(false);
    }
  }

  async function openPlayerSearch(position: Position) {
    setShowPlayerSearch(position);
    setSearchQuery('');
    setSearchPosition(position === 'SP' ? 'SP' : position);
    setSearchResults([]);
    
    // Automatically load players for this position
    await loadPlayersForPosition(position);
  }

  async function loadPlayersForPosition(position: Position) {
    console.log('Loading players for position:', position);
    setSearchLoading(true);
    try {
      const params: any = { 
        limit: 50, // Show more results by default
        sort: position === 'SP' ? 'era' : 'ops' // Sort by relevant stat
      };
      
      // Map position to search parameter
      if (position === 'SP') {
        params.position = 'SP'; // Search for starting pitchers specifically
      } else if (position !== 'DH') {
        params.position = position; // For specific positions
      }
      // For DH, don't filter by position - show all position players
      
      console.log('API params:', params);
      const { players } = await api.getPlayers(params);
      console.log('Loaded players:', players.length);
      setSearchResults(players);
    } catch (error) {
      console.error('Failed to load players for position:', error);
    } finally {
      setSearchLoading(false);
    }
  }

  function closePlayerSearch() {
    setShowPlayerSearch(null);
    setSearchQuery('');
    setSearchResults([]);
  }

  async function addPlayerToRoster(player: MLBPlayer, position: Position) {
    console.log('addPlayerToRoster called:', { player: player.fullName, position, teamId: team?.id });
    
    if (!team) {
      console.error('No team found');
      return;
    }

    const currentRoster = team.roster || [];
    console.log('Current roster length:', currentRoster.length);
    
    const updatedRoster = currentRoster.filter(slot => slot.position !== position);
    const battingOrder = position === 'SP' ? null : getNextBattingOrder(updatedRoster);
    
    const newSlot = {
      position,
      mlbPlayerId: player.mlbId,
      battingOrder
    };
    
    updatedRoster.push(newSlot);
    console.log('Updated roster length:', updatedRoster.length);

    const updatedTeam = { 
      ...team, 
      roster: updatedRoster,
      rosterComplete: isRosterComplete(updatedRoster)
    };
    
    console.log('Updated team:', { rosterLength: updatedTeam.roster.length, rosterComplete: updatedTeam.rosterComplete });
    
    // Update local state immediately for responsive UI
    setTeam(updatedTeam);
    setPopulatedRoster(prev => ({
      ...prev,
      [player.mlbId.toString()]: player
    }));
    closePlayerSearch();
    
    // Auto-save if roster is now complete
    if (updatedTeam.rosterComplete) {
      console.log('Roster complete, auto-saving...');
      await saveCompleteRoster(updatedTeam);
    }
    
    console.log(`Added ${player.fullName} to ${position} position`);
  }

  async function saveCompleteRoster(teamToSave: Team) {
    setSavingPosition('SP'); // Use SP as a general "saving" indicator
    try {
      const slots = (teamToSave.roster || []).map(slot => ({
        position: slot.position,
        mlbPlayerId: slot.mlbPlayerId,
        battingOrder: slot.battingOrder
      }));

      await api.updateTeamRoster(teamToSave.id, slots);
      
      // Update the team store with the saved state
      updateTeam(teamToSave.id, teamToSave);
      
      console.log('Complete roster saved successfully!');
    } catch (error) {
      console.error('Failed to save complete roster:', error);
      
      // TODO: Show user-friendly error message/toast
      alert('Failed to save roster. Please try again.');
    } finally {
      setSavingPosition(null);
    }
  }

  function removePlayerFromRoster(position: Position) {
    if (!team) return;

    const currentRoster = team.roster || [];
    const slotToRemove = currentRoster.find(slot => slot.position === position);
    const updatedRoster = currentRoster.filter(slot => slot.position !== position);
    const updatedTeam = { 
      ...team, 
      roster: updatedRoster,
      rosterComplete: isRosterComplete(updatedRoster)
    };
    
    // Update local state immediately for responsive UI
    setTeam(updatedTeam);
    if (slotToRemove) {
      setPopulatedRoster(prev => {
        const updated = { ...prev };
        delete updated[slotToRemove.mlbPlayerId.toString()];
        return updated;
      });
    }
    
    console.log(`Removed player from ${position} position`);
    // Note: Not auto-saving on remove since roster will be incomplete
    // User can manually save if needed or auto-save will happen when roster is complete again
  }

  function getNextBattingOrder(roster: RosterSlot[]): number {
    const usedOrders = roster
      .map(slot => slot.battingOrder)
      .filter(order => order !== null)
      .sort((a, b) => (a || 0) - (b || 0));
    
    for (let i = 1; i <= 9; i++) {
      if (!usedOrders.includes(i)) {
        return i;
      }
    }
    return 9;
  }

  function isRosterComplete(roster: RosterSlot[]): boolean {
    const hasAllPositions = POSITIONS.every(pos => 
      roster.some(slot => slot.position === pos)
    );
    const hasBattingOrder = roster
      .filter(slot => slot.position !== 'SP')
      .every(slot => slot.battingOrder !== null);
    
    return hasAllPositions && hasBattingOrder;
  }

  async function saveRoster() {
    if (!team) return;
    
    if (!team.rosterComplete) {
      alert('Please fill all 10 positions before saving.');
      return;
    }
    
    await saveCompleteRoster(team);
  }

  function goBackToTeams() {
    navigate('/teams');
  }

  if (loading || !team) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <Header title="Loading..." showBack />
        <PageContainer>
          <div className="space-y-4">
            {POSITIONS.map((pos, i) => (
              <Card key={pos} className="animate-pulse">
                <CardContent>
                  <div className="h-6 bg-gray-700 rounded w-24 mb-2" />
                  <div className="h-4 bg-gray-700 rounded w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </PageContainer>
      </div>
    );
  }

  const roster = team.roster || [];
  console.log('TeamEditor render - roster:', roster.length, 'players');
  
  const rosterByPosition = roster.reduce((acc, slot) => {
    acc[slot.position] = slot;
    return acc;
  }, {} as Record<Position, RosterSlot>);
  
  console.log('Roster by position:', rosterByPosition);

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header
        title={team.name.toUpperCase()}
        showBack
        rightAction={
          <div className="flex gap-2">
            {team.rosterComplete && (
              <Button 
                size="sm" 
                onClick={saveRoster}
                disabled={savingPosition !== null}
              >
                {savingPosition ? 'SAVING...' : 'SAVE'}
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost"
              onClick={goBackToTeams}
            >
              DONE
            </Button>
          </div>
        }
      />

      <PageContainer>
        <div className="space-y-4">
          {/* Roster Status */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Roster Status</h3>
                  <p className="text-sm text-gray-400">
                    {roster.length}/10 positions filled
                  </p>
                  {savingPosition && (
                    <p className="text-xs text-blue-400 mt-1">
                      💾 Saving to server...
                    </p>
                  )}
                  {!savingPosition && team.rosterComplete && (
                    <p className="text-xs text-green-400 mt-1">
                      ✅ Ready to save roster
                    </p>
                  )}
                </div>
                {team.rosterComplete ? (
                  <span className="text-green-500 text-sm font-semibold">✓ Complete</span>
                ) : (
                  <span className="text-yellow-500 text-sm font-semibold">⚠️ Incomplete</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Position Slots */}
          {POSITIONS.map((position) => {
            const slot = rosterByPosition[position];
            const player = slot ? populatedRoster[slot.mlbPlayerId.toString()] : null;
            
            return (
              <Card key={position}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-300">
                          {position}
                        </span>
                        <span className="text-xs text-gray-500">
                          {POSITION_NAMES[position]}
                        </span>
                        {slot?.battingOrder && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                            #{slot.battingOrder}
                          </span>
                        )}
                      </div>
                      
                      {player ? (
                        <div>
                          <p className="text-white font-medium">{player.fullName}</p>
                          <p className="text-sm text-gray-400">{player.currentTeam}</p>
                          {player.battingStats && position !== 'SP' && (
                            <p className="text-xs text-gray-500">
                              AVG: {player.battingStats.avg.toFixed(3)} | 
                              OPS: {player.battingStats.ops.toFixed(3)}
                            </p>
                          )}
                          {player.pitchingStats && position === 'SP' && (
                            <p className="text-xs text-gray-500">
                              ERA: {player.pitchingStats.era.toFixed(2)} | 
                              WHIP: {player.pitchingStats.whip.toFixed(2)}
                            </p>
                          )}
                        </div>
                      ) : slot ? (
                        <div>
                          <p className="text-gray-400">Loading player data...</p>
                          <p className="text-xs text-gray-500">Player ID: {slot.mlbPlayerId}</p>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No player assigned</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2 items-center">
                      {savingPosition === position && (
                        <div className="text-blue-400 text-xs animate-spin mr-2">
                          ⟳
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPlayerSearch(position)}
                        disabled={savingPosition === position}
                      >
                        {slot ? 'Change' : 'Add'}
                      </Button>
                      {slot && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removePlayerFromRoster(position)}
                          className="text-red-400 hover:text-red-300"
                          disabled={savingPosition === position}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageContainer>

      {/* Player Search Modal */}
      {showPlayerSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <CardContent className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-bold text-white">
                  Select {POSITION_NAMES[showPlayerSearch]}
                </h3>
                <Button size="sm" variant="ghost" onClick={closePlayerSearch}>
                  ✕
                </Button>
              </div>

              <div className="mb-4">
                <Input
                  placeholder={`Search ${POSITION_NAMES[showPlayerSearch]} by name...`}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // Auto-search as user types (debounced)
                    if (searchTimeoutRef.current) {
                      clearTimeout(searchTimeoutRef.current);
                    }
                    searchTimeoutRef.current = setTimeout(() => {
                      searchPlayers();
                    }, 300);
                  }}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {searchQuery ? 
                    `Searching ${searchPosition || 'all players'} for "${searchQuery}"` : 
                    `Showing ${searchPosition || 'all'} players sorted by ${showPlayerSearch === 'SP' ? 'ERA' : 'OPS'}`
                  }
                </p>
                
                {/* TODO: Add filters for League, Team, Salary Range, etc. */}
                {/* TODO: Add sorting options (multiple stats) */}
                {/* TODO: Add player comparison view */}
              </div>

              <div className="overflow-y-auto flex-1 space-y-2 max-h-96">
                {searchLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent>
                          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-700 rounded w-1/2 mb-1" />
                          <div className="h-3 bg-gray-700 rounded w-2/3" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((player) => (
                    <Card key={player.mlbId} variant="interactive">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => {
                              console.log('Player clicked:', player.fullName, 'for position:', showPlayerSearch);
                              addPlayerToRoster(player, showPlayerSearch!);
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-white">{player.fullName}</p>
                              {player.primaryPosition !== (showPlayerSearch === 'SP' ? 'P' : showPlayerSearch) && (
                                <span className="text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded">
                                  {player.primaryPosition}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 mb-1">
                              {player.currentTeam}
                            </p>
                            {player.battingStats && showPlayerSearch !== 'SP' && (
                              <div className="text-xs text-gray-500 space-y-0.5">
                                <p>
                                  <span className="font-medium">AVG:</span> {player.battingStats.avg.toFixed(3)} | 
                                  <span className="font-medium"> OPS:</span> {player.battingStats.ops.toFixed(3)} | 
                                  <span className="font-medium"> HR:</span> {player.battingStats.homeRuns}
                                </p>
                                <p>
                                  <span className="font-medium">R:</span> {player.battingStats.runs} | 
                                  <span className="font-medium"> RBI:</span> {player.battingStats.rbi} | 
                                  <span className="font-medium"> SB:</span> {player.battingStats.stolenBases}
                                </p>
                              </div>
                            )}
                            {player.pitchingStats && showPlayerSearch === 'SP' && (
                              <div className="text-xs text-gray-500 space-y-0.5">
                                <p>
                                  <span className="font-medium">ERA:</span> {player.pitchingStats.era.toFixed(2)} | 
                                  <span className="font-medium"> WHIP:</span> {player.pitchingStats.whip.toFixed(2)} | 
                                  <span className="font-medium"> K/9:</span> {player.pitchingStats.kPer9.toFixed(1)}
                                </p>
                                <p>
                                  <span className="font-medium">W-L:</span> {player.pitchingStats.wins}-{player.pitchingStats.losses} | 
                                  <span className="font-medium"> IP:</span> {player.pitchingStats.inningsPitched.toFixed(1)} | 
                                  <span className="font-medium"> SO:</span> {player.pitchingStats.strikeouts}
                                </p>
                              </div>
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            className="ml-4 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent event bubbling
                              console.log('Select button clicked:', player.fullName, 'for position:', showPlayerSearch);
                              addPlayerToRoster(player, showPlayerSearch!);
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    {searchQuery ? (
                      <>
                        <p className="text-gray-400">No players found</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Try adjusting your search query
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-400">No players available</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Check your connection or try again later
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}