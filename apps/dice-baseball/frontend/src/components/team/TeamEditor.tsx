/**
 * TeamEditor - Full team editing interface with roster management
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Card, CardContent, Input, ConfirmDialog } from '../common';
import { Header, PageContainer } from '../layout/Header';
import { BattingOrderEditor } from './BattingOrderEditor';
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
  const { teams, setCurrentEditingTeam, updateTeam, setHasUnsavedChanges, hasUnsavedChanges } = useTeamStore();
  
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
  const [showBattingOrder, setShowBattingOrder] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (team && hasUnsavedChanges) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      // Set new auto-save timeout for 30 seconds
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSaveDraft();
      }, 30000);
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, hasUnsavedChanges]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
      const params: api.GetPlayersParams = {
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
      const params: api.GetPlayersParams = {
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
    setHasUnsavedChanges(true);
    closePlayerSearch();
    
    // Mark as having unsaved changes when roster becomes complete
    if (updatedTeam.rosterComplete) {
      console.log('Roster complete! Click "Save & Complete" to finalize.');
      // Don't auto-save complete rosters - let user click the button
      setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(false);
      
      console.log('Complete roster saved successfully!');
      toast.success('Team saved successfully! Ready to play!');
    } catch (error) {
      console.error('Failed to save complete roster:', error);
      
      toast.error('Failed to save roster. Please try again.');
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
    setHasUnsavedChanges(true);
    
    console.log(`Removed player from ${position} position`);
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
      toast.error('Please fill all 10 positions before saving.');
      return;
    }
    
    await saveCompleteRoster(team);
  }

  async function handleSaveDraft() {
    if (!team) return;
    
    setSaving(true);
    try {
      const slots = (team.roster || []).map(slot => ({
        position: slot.position,
        mlbPlayerId: slot.mlbPlayerId,
        battingOrder: slot.battingOrder
      }));

      await api.saveTeamDraft(team.id, slots);
      setHasUnsavedChanges(false);
      console.log('Draft saved successfully!');
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast.error('Failed to save draft. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleReorderBattingOrder(newPlayerOrder: number[]) {
    if (!team) return;
    
    const updatedRoster = team.roster?.map(slot => {
      if (slot.position === 'SP') return slot; // Skip pitcher
      
      const newIndex = newPlayerOrder.indexOf(slot.mlbPlayerId);
      return {
        ...slot,
        battingOrder: newIndex >= 0 ? newIndex + 1 : slot.battingOrder
      };
    }) || [];
    
    const updatedTeam = { ...team, roster: updatedRoster };
    setTeam(updatedTeam);
    setHasUnsavedChanges(true);
  }

  async function saveBattingOrder() {
    if (!team) return;
    
    try {
      const order = team.roster
        ?.filter(slot => slot.position !== 'SP' && slot.battingOrder !== null)
        .sort((a, b) => (a.battingOrder || 0) - (b.battingOrder || 0))
        .map(slot => slot.position) || [];
      
      await api.updateBattingOrder(team.id, order);
      updateTeam(team.id, team);
      setHasUnsavedChanges(false);
      setShowBattingOrder(false);
      console.log('Batting order saved successfully!');
    } catch (error) {
      console.error('Failed to save batting order:', error);
      toast.error('Failed to save batting order. Please try again.');
    }
  }

  function handleNavigate(path: string) {
    if (hasUnsavedChanges) {
      setPendingNavigation(path);
      setShowLeaveConfirm(true);
    } else {
      navigate(path);
    }
  }

  function confirmLeave() {
    if (pendingNavigation) {
      setHasUnsavedChanges(false);
      navigate(pendingNavigation);
    }
    setShowLeaveConfirm(false);
    setPendingNavigation(null);
  }

  function goBackToTeams() {
    handleNavigate('/teams');
  }

  if (loading || !team) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <Header title="Loading..." showBack />
        <PageContainer>
          <div className="space-y-4">
            {POSITIONS.map((pos) => (
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
            {hasUnsavedChanges && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={handleSaveDraft}
                disabled={saving}
              >
                {saving ? 'SAVING...' : 'SAVE DRAFT'}
              </Button>
            )}
            {team.rosterComplete && (
              <Button 
                size="sm" 
                onClick={saveRoster}
                disabled={savingPosition !== null}
              >
                {savingPosition ? 'SAVING...' : 'SAVE & COMPLETE'}
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
                  {saving && (
                    <p className="text-xs text-blue-400 mt-1">
                      💾 Saving draft...
                    </p>
                  )}
                  {savingPosition && (
                    <p className="text-xs text-blue-400 mt-1">
                      💾 Saving complete roster...
                    </p>
                  )}
                  {hasUnsavedChanges && !saving && !savingPosition && (
                    <p className="text-xs text-yellow-400 mt-1">
                      ⚠️ Unsaved changes
                    </p>
                  )}
                  {!hasUnsavedChanges && !saving && !savingPosition && team.rosterComplete && (
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

          {/* Batting Order Section */}
          {roster.filter(s => s.position !== 'SP').length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Batting Order</h3>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setShowBattingOrder(!showBattingOrder)}
                >
                  {showBattingOrder ? 'Hide' : 'Edit Order'}
                </Button>
              </div>
              
              {showBattingOrder && (
                <BattingOrderEditor
                  roster={roster}
                  populatedRoster={populatedRoster}
                  onReorder={handleReorderBattingOrder}
                  onSave={saveBattingOrder}
                  disabled={saving || savingPosition !== null}
                />
              )}
            </>
          )}

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

      {/* Leave Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLeaveConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes that will be lost. Are you sure you want to leave?"
        confirmText="Leave"
        cancelText="Stay"
        confirmVariant="danger"
        onConfirm={confirmLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}
