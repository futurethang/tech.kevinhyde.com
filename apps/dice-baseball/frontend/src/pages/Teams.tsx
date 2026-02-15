/**
 * Teams Page - List and manage teams
 * v5 Topps design: navy palette, gold accents, token colors
 */

import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Card, CardContent, Input, ConfirmDialog } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { TeamEditor } from '../components/team';
import { useTeamStore } from '../stores/teamStore';
import * as api from '../services/api';
import type { Team } from '../types';

export function Teams() {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const { teams, setTeams, setLoading, isLoading, deleteTeam: deleteTeamFromStore, reorderTeams } = useTeamStore();
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; teamId: string; teamName: string }>({ show: false, teamId: '', teamName: '' });
  const [duplicateModal, setDuplicateModal] = useState<{ show: boolean; teamId: string; teamName: string }>({ show: false, teamId: '', teamName: '' });
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicating, setDuplicating] = useState(false);
  const [draggedTeam, setDraggedTeam] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (!teamId) {
      loadTeams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (teamId) {
    return <TeamEditor teamId={teamId} />;
  }

  async function loadTeams() {
    setLoading(true);
    try {
      const { teams } = await api.getTeams();
      setTeams(teams);
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;

    setCreating(true);
    try {
      const team = await api.createTeam(newTeamName.trim());
      setTeams([...teams, team]);
      setShowNewTeamModal(false);
      setNewTeamName('');
      navigate(`/teams/${team.id}`);
    } catch (error) {
      console.error('Failed to create team:', error);
    } finally {
      setCreating(false);
    }
  }

  function handleDeleteClick(team: Team) {
    setDeleteConfirm({ show: true, teamId: team.id, teamName: team.name });
  }

  async function confirmDelete() {
    const teamId = deleteConfirm.teamId;
    setDeleteConfirm({ show: false, teamId: '', teamName: '' });

    try {
      await api.deleteTeam(teamId);
      deleteTeamFromStore(teamId);
    } catch (error) {
      console.error('Failed to delete team:', error);
      toast.error('Failed to delete team. Please try again.');
    }
  }

  function handleDuplicateClick(team: Team) {
    setDuplicateModal({ show: true, teamId: team.id, teamName: team.name });
    setDuplicateName(`${team.name} Copy`);
  }

  async function confirmDuplicate() {
    if (!duplicateName.trim()) return;

    const teamId = duplicateModal.teamId;
    setDuplicating(true);

    try {
      const newTeam = await api.duplicateTeam(teamId, duplicateName.trim());
      setTeams([...teams, newTeam]);
      setDuplicateModal({ show: false, teamId: '', teamName: '' });
      setDuplicateName('');
      navigate(`/teams/${newTeam.id}`);
    } catch (error) {
      console.error('Failed to duplicate team:', error);
      toast.error('Failed to duplicate team. Please try again.');
    } finally {
      setDuplicating(false);
    }
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, teamId: string) {
    setDraggedTeam(teamId);
    e.dataTransfer.setData('text/plain', teamId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (draggedTeam) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, dropTeamId: string) {
    e.preventDefault();

    if (!draggedTeam || draggedTeam === dropTeamId) {
      setDraggedTeam(null);
      return;
    }

    const dragIndex = teams.findIndex(t => t.id === draggedTeam);
    const dropIndex = teams.findIndex(t => t.id === dropTeamId);

    if (dragIndex === -1 || dropIndex === -1) {
      setDraggedTeam(null);
      return;
    }

    const newTeams = [...teams];
    const [draggedItem] = newTeams.splice(dragIndex, 1);
    newTeams.splice(dropIndex, 0, draggedItem);

    const newOrder = newTeams.map(t => t.id);
    reorderTeams(newOrder);
    setDraggedTeam(null);

    saveTeamOrder(newOrder);
  }

  async function saveTeamOrder(teamIds: string[]) {
    setReordering(true);
    try {
      await api.reorderTeams(teamIds);
    } catch (error) {
      console.error('Failed to save team order:', error);
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
      <Header
        title="MY TEAMS"
        showBack
        rightAction={
          <Button size="sm" onClick={() => setShowNewTeamModal(true)}>
            + NEW
          </Button>
        }
      />

      <PageContainer>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent>
                  <div className="h-5 bg-[var(--color-surface-hover)] w-1/2 mb-2" />
                  <div className="h-4 bg-[var(--color-surface-hover)] w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">&#x26BE;</div>
            <p className="text-[var(--color-text-muted)] mb-4">No teams yet!</p>
            <p className="text-sm text-[var(--color-text-dim)] mb-6">
              Build your first team to start playing.
            </p>
            <Button onClick={() => setShowNewTeamModal(true)}>+ Create Team</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onDelete={() => handleDeleteClick(team)}
                onDuplicate={() => handleDuplicateClick(team)}
                onDragStart={(e) => handleDragStart(e, team.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, team.id)}
                isDragging={draggedTeam === team.id}
                showReorderControls={teams.length > 1}
              />
            ))}
            {reordering && (
              <div className="text-center py-2">
                <span className="text-sm text-[var(--color-text-muted)]">Saving team order...</span>
              </div>
            )}
          </div>
        )}
      </PageContainer>

      {/* New Team Modal */}
      {showNewTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm">
            <CardContent>
              <h3 className="text-lg font-display font-bold text-[var(--color-text-primary)] mb-4 ink-bleed">
                Create New Team
              </h3>
              <Input
                label="Team Name"
                placeholder="Enter team name..."
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                maxLength={50}
              />
              <div className="flex gap-3 mt-6">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowNewTeamModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateTeam}
                  isLoading={creating}
                  disabled={!newTeamName.trim()}
                >
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Delete Team"
        message={`Are you sure you want to delete "${deleteConfirm.teamName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, teamId: '', teamName: '' })}
      />

      {/* Duplicate Team Modal */}
      {duplicateModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm">
            <CardContent>
              <h3 className="text-lg font-display font-bold text-[var(--color-text-primary)] mb-4 ink-bleed">
                Duplicate Team
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                Creating a copy of &quot;{duplicateModal.teamName}&quot;
              </p>
              <Input
                label="New Team Name"
                placeholder="Enter team name..."
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                maxLength={50}
              />
              <div className="flex gap-3 mt-6">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setDuplicateModal({ show: false, teamId: '', teamName: '' });
                    setDuplicateName('');
                  }}
                  disabled={duplicating}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={confirmDuplicate}
                  isLoading={duplicating}
                  disabled={!duplicateName.trim()}
                >
                  Duplicate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface TeamCardProps {
  team: Team;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  showReorderControls: boolean;
}

function TeamCard({
  team,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  showReorderControls
}: TeamCardProps) {
  const rosterCount = team.roster?.length || 0;
  const hasPitcher = team.roster?.some((s) => s.position === 'SP');
  const positionPlayersCount = rosterCount - (hasPitcher ? 1 : 0);
  const battingOrderComplete = team.roster?.filter(s => s.position !== 'SP' && s.battingOrder !== null).length || 0;

  return (
    <div
      draggable={showReorderControls}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`
        group relative transition-all duration-200
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${showReorderControls ? 'cursor-move' : ''}
      `}
    >
      {/* Drag handle */}
      {showReorderControls && (
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-sm">&#x22EE;&#x22EE;</span>
        </div>
      )}

      <Card variant="interactive" className={showReorderControls ? 'ml-6' : ''}>
        <CardContent>
          <div className="flex items-start justify-between">
            {/* Team Info */}
            <Link to={`/teams/${team.id}`} className="flex-1 min-w-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {team.isActive && (
                    <span className="inline-block text-xs text-[var(--color-topps-gold)] font-semibold font-display">
                      ACTIVE
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 font-display ${
                    team.rosterComplete
                      ? 'bg-[var(--color-stadium-green)]/20 text-[var(--color-stadium-green)] border border-[var(--color-stadium-green)]/30'
                      : 'bg-[var(--color-topps-gold)]/20 text-[var(--color-topps-gold)] border border-[var(--color-topps-gold)]/30'
                  }`}>
                    {team.rosterComplete ? 'COMPLETE' : 'DRAFT'}
                  </span>
                </div>
                <h3 className="font-semibold text-[var(--color-text-primary)] text-lg mb-2 truncate font-display">{team.name}</h3>

                {/* Roster Status */}
                <div className="space-y-1">
                  <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                    <span>{positionPlayersCount}/9 Position Players</span>
                    <span>{hasPitcher ? '1/1' : '0/1'} Pitcher</span>
                  </div>

                  {positionPlayersCount > 0 && (
                    <div className="text-xs text-[var(--color-text-dim)]">
                      Batting Order: {battingOrderComplete}/9 set
                    </div>
                  )}

                  {!team.rosterComplete && rosterCount > 0 && (
                    <p className="text-xs text-[var(--color-topps-gold)] mt-1">
                      {10 - rosterCount} positions remaining
                    </p>
                  )}
                </div>
              </div>
            </Link>

            {/* Action Buttons */}
            <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="text-[var(--color-topps-blue)] hover:text-[var(--color-topps-blue)] p-1 h-auto"
                title="Duplicate team"
              >
                &#x1F4CB;
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-[var(--color-card-red)] hover:text-[var(--color-card-red)] p-1 h-auto"
                title="Delete team"
              >
                &#x1F5D1;&#xFE0F;
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
