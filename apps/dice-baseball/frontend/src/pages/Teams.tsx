/**
 * Teams Page - List and manage teams
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardContent, Input } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { TeamEditor } from '../components/team';
import { useTeamStore } from '../stores/teamStore';
import * as api from '../services/api';
import type { Team } from '../types';

export function Teams() {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId: string }>();
  const { teams, setTeams, setLoading, isLoading } = useTeamStore();
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!teamId) {
      loadTeams();
    }
  }, [teamId]);

  // If teamId is present, show the team editor
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
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
                  <div className="h-5 bg-gray-700 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-gray-700 rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">⚾</div>
            <p className="text-gray-400 mb-4">No teams yet!</p>
            <p className="text-sm text-gray-500 mb-6">
              Build your first team to start playing.
            </p>
            <Button onClick={() => setShowNewTeamModal(true)}>+ Create Team</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </PageContainer>

      {/* New Team Modal */}
      {showNewTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm">
            <CardContent>
              <h3 className="text-lg font-display font-bold text-white mb-4">
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
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const rosterCount = team.roster?.length || 0;
  const hasPitcher = team.roster?.some((s) => s.position === 'SP');

  return (
    <Link to={`/teams/${team.id}`}>
      <Card variant="interactive">
        <CardContent>
          {team.isActive && (
            <span className="inline-block text-xs text-green-500 font-semibold mb-1">
              ⭐ ACTIVE
            </span>
          )}
          <h3 className="font-semibold text-white text-lg">{team.name}</h3>
          <p className="text-sm text-gray-400">
            {rosterCount}/9 Players | {hasPitcher ? '1' : '0'} Pitcher
          </p>
          {!team.rosterComplete && (
            <p className="text-sm text-yellow-500 mt-1">⚠️ Incomplete roster</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
