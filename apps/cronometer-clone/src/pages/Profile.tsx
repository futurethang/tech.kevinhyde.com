import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import type { ActivityLevel, GoalType } from '../types'
import { calculateAge, formatWeight } from '../utils/calculations'
import { ArrowLeft, Save } from 'lucide-react'

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  active: 'Active',
  very_active: 'Very Active'
}

export function Profile() {
  const navigate = useNavigate()
  const { profile, metrics, setProfile } = useStore()

  const [name, setName] = useState(profile?.name || '')
  const [birthDate, setBirthDate] = useState(profile?.birthDate || '')
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex || 'male')
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() || '')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activityLevel || 'moderate')
  const [goalType, setGoalType] = useState<GoalType>(profile?.goalType || 'lose')
  const [targetWeight, setTargetWeight] = useState(profile?.targetWeightKg?.toString() || '')
  const [targetDate, setTargetDate] = useState(profile?.targetDate || '')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setBirthDate(profile.birthDate)
      setSex(profile.sex)
      setHeightCm(profile.heightCm.toString())
      setActivityLevel(profile.activityLevel)
      setGoalType(profile.goalType)
      setTargetWeight(profile.targetWeightKg.toString())
      setTargetDate(profile.targetDate)
    }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    const changed =
      name !== profile.name ||
      birthDate !== profile.birthDate ||
      sex !== profile.sex ||
      heightCm !== profile.heightCm.toString() ||
      activityLevel !== profile.activityLevel ||
      goalType !== profile.goalType ||
      targetWeight !== profile.targetWeightKg.toString() ||
      targetDate !== profile.targetDate
    setHasChanges(changed)
  }, [profile, name, birthDate, sex, heightCm, activityLevel, goalType, targetWeight, targetDate])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await setProfile({
        name: name || 'User',
        birthDate,
        sex,
        heightCm: parseFloat(heightCm),
        activityLevel,
        goalType,
        targetWeightKg: parseFloat(targetWeight),
        targetDate
      })
      navigate('/')
    } catch (error) {
      console.error('Failed to save profile:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const age = birthDate ? calculateAge(birthDate) : 0

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 p-4 border-b border-slate-800">
        <button
          onClick={() => navigate('/')}
          className="p-2 -m-2 text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-medium flex-1">Profile</h1>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary py-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-auto">
        {/* Stats summary */}
        {metrics && (
          <div className="p-4 grid grid-cols-2 gap-3">
            <StatCard label="Daily Target" value={`${metrics.dailyCalorieTarget} cal`} />
            <StatCard label="TDEE" value={`${metrics.tdee} cal`} />
            <StatCard label="BMR" value={`${metrics.bmr} cal`} />
            <StatCard label="BMI" value={metrics.bmi.toString()} />
            <StatCard
              label="Current Weight"
              value={formatWeight(metrics.currentWeightKg)}
            />
            {metrics.projectedDaysToGoal > 0 && (
              <StatCard
                label="Days to Goal"
                value={metrics.projectedDaysToGoal.toString()}
              />
            )}
          </div>
        )}

        {/* Form */}
        <div className="p-4 space-y-6">
          <section className="card space-y-4">
            <h2 className="font-medium text-slate-300">Personal Info</h2>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">Birth Date</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Age</label>
                <div className="py-3 px-4 bg-slate-700 rounded-lg text-slate-300">
                  {age} years
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Sex</label>
              <div className="grid grid-cols-2 gap-2">
                {(['male', 'female'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    className={`py-2 px-4 rounded-lg border-2 capitalize ${
                      sex === s
                        ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Height (cm)</label>
              <input
                type="number"
                value={heightCm}
                onChange={e => setHeightCm(e.target.value)}
                className="w-full"
              />
            </div>
          </section>

          <section className="card space-y-4">
            <h2 className="font-medium text-slate-300">Activity Level</h2>

            <div className="space-y-2">
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setActivityLevel(level)}
                  className={`w-full text-left py-2 px-4 rounded-lg border-2 ${
                    activityLevel === level
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {ACTIVITY_LABELS[level]}
                </button>
              ))}
            </div>
          </section>

          <section className="card space-y-4">
            <h2 className="font-medium text-slate-300">Goal</h2>

            <div>
              <label className="block text-sm text-slate-500 mb-1">Goal Type</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'lose', label: 'Lose' },
                  { value: 'maintain', label: 'Maintain' },
                  { value: 'gain', label: 'Gain' }
                ] as const).map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGoalType(g.value)}
                    className={`py-2 px-4 rounded-lg border-2 ${
                      goalType === g.value
                        ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {goalType !== 'maintain' && (
              <>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Target Weight (kg)</label>
                  <input
                    type="number"
                    value={targetWeight}
                    onChange={e => setTargetWeight(e.target.value)}
                    className="w-full"
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-500 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="w-full"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card text-center">
      <div className="text-xl font-semibold text-primary-400">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
