import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { getWeightEntries, deleteWeightEntry } from '../db'
import type { WeightEntry } from '../types'
import { formatWeight, formatDate } from '../utils/calculations'
import { ArrowLeft, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'

export function Weight() {
  const navigate = useNavigate()
  const { profile, metrics, addWeight, latestWeight } = useStore()

  const [entries, setEntries] = useState<WeightEntry[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadEntries()
  }, [latestWeight])

  const loadEntries = async () => {
    const data = await getWeightEntries(30)
    setEntries(data)
  }

  const handleAdd = async () => {
    if (!newWeight) return

    setIsSaving(true)
    try {
      await addWeight(parseFloat(newWeight), note || undefined)
      setNewWeight('')
      setNote('')
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to add weight:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteWeightEntry(id)
    loadEntries()
  }

  const firstEntry = entries[0]
  const lastEntry = entries[entries.length - 1]
  const weightChange = entries.length >= 2 && firstEntry && lastEntry
    ? firstEntry.weightKg - lastEntry.weightKg
    : 0

  const toGoal = profile && metrics
    ? metrics.currentWeightKg - profile.targetWeightKg
    : 0

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 p-4 border-b border-slate-800">
        <button
          onClick={() => navigate('/')}
          className="p-2 -m-2 text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-medium flex-1">Weight</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary py-2"
        >
          <Plus className="w-4 h-4" />
          Log
        </button>
      </header>

      {/* Summary */}
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-primary-400">
            {metrics ? formatWeight(metrics.currentWeightKg) : '--'}
          </div>
          <div className="text-xs text-slate-500">Current</div>
        </div>

        <div className="card text-center">
          <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${
            weightChange < 0 ? 'text-green-400' : weightChange > 0 ? 'text-red-400' : 'text-slate-400'
          }`}>
            {weightChange !== 0 && (
              weightChange < 0
                ? <TrendingDown className="w-5 h-5" />
                : <TrendingUp className="w-5 h-5" />
            )}
            {weightChange === 0 ? '--' : `${Math.abs(Math.round(weightChange * 10) / 10)}`}
          </div>
          <div className="text-xs text-slate-500">Change</div>
        </div>

        <div className="card text-center">
          <div className={`text-2xl font-bold ${
            toGoal <= 0 ? 'text-green-400' : 'text-slate-300'
          }`}>
            {profile ? formatWeight(Math.abs(toGoal)) : '--'}
          </div>
          <div className="text-xs text-slate-500">
            {toGoal <= 0 ? 'Goal Reached!' : 'To Goal'}
          </div>
        </div>
      </div>

      {/* Add weight form */}
      {showAddForm && (
        <div className="mx-4 mb-4 card space-y-4">
          <h3 className="font-medium">Log Weight</h3>

          <div>
            <label className="block text-sm text-slate-500 mb-1">Weight (kg)</label>
            <input
              type="number"
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              placeholder={latestWeight ? latestWeight.weightKg.toString() : '70'}
              className="w-full text-xl text-center"
              step="0.1"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-slate-500 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Morning, after workout..."
              className="w-full"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowAddForm(false)}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newWeight || isSaving}
              className="btn btn-primary flex-1"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="flex-1 overflow-auto p-4">
        <h2 className="text-sm text-slate-500 mb-3">History</h2>

        {entries.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No weight entries yet
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => {
              const prevEntry = entries[index + 1]
              const change = prevEntry
                ? entry.weightKg - prevEntry.weightKg
                : 0

              return (
                <div
                  key={entry.id}
                  className="card flex items-center gap-4 group"
                >
                  <div className="flex-1">
                    <div className="font-medium">{formatWeight(entry.weightKg)}</div>
                    <div className="text-sm text-slate-500">
                      {formatDate(entry.date)}
                      {entry.note && ` · ${entry.note}`}
                    </div>
                  </div>

                  {change !== 0 && (
                    <div className={`flex items-center gap-1 text-sm ${
                      change < 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {change < 0 ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : (
                        <TrendingUp className="w-4 h-4" />
                      )}
                      {Math.abs(Math.round(change * 10) / 10)} kg
                    </div>
                  )}

                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Goal info */}
      {profile && metrics && profile.goalType !== 'maintain' && (
        <div className="p-4 border-t border-slate-800 safe-bottom">
          <div className="text-center text-sm text-slate-500">
            Goal: {formatWeight(profile.targetWeightKg)} by{' '}
            {new Date(profile.targetDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
            {metrics.projectedDaysToGoal > 0 && (
              <span className="block mt-1">
                ~{metrics.projectedDaysToGoal} days at current deficit
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
