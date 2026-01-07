import { useState } from 'react'
import { useStore } from '../store'
import type { ActivityLevel, GoalType } from '../types'
import { ArrowRight, ArrowLeft, Scale, Target, Activity } from 'lucide-react'

type Step = 'basics' | 'body' | 'goal'

const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: 'Sedentary', desc: 'Desk job, little exercise' },
  light: { label: 'Lightly Active', desc: '1-3 days/week exercise' },
  moderate: { label: 'Moderately Active', desc: '3-5 days/week exercise' },
  active: { label: 'Active', desc: '6-7 days/week exercise' },
  very_active: { label: 'Very Active', desc: 'Physical job + daily exercise' }
}

export function Onboarding() {
  const setProfile = useStore(state => state.setProfile)
  const addWeight = useStore(state => state.addWeight)

  const [step, setStep] = useState<Step>('basics')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [heightCm, setHeightCm] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [goalType, setGoalType] = useState<GoalType>('lose')
  const [targetWeight, setTargetWeight] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      // Save profile
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

      // Save initial weight
      if (currentWeight) {
        await addWeight(parseFloat(currentWeight))
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Default target date (3 months from now)
  const getDefaultTargetDate = () => {
    const date = new Date()
    date.setMonth(date.getMonth() + 3)
    return date.toISOString().split('T')[0]
  }

  return (
    <div className="min-h-screen p-6 flex flex-col">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-primary-400 mb-2">CalTrack</h1>
        <p className="text-slate-400">Let's get you set up</p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-8">
        {(['basics', 'body', 'goal'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`w-3 h-3 rounded-full transition-colors ${
              s === step ? 'bg-primary-500' :
              (['basics', 'body', 'goal'].indexOf(step) > i) ? 'bg-primary-700' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1">
        {step === 'basics' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Activity className="w-12 h-12 mx-auto text-primary-500 mb-3" />
              <h2 className="text-xl font-semibold">About You</h2>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Your Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Date of Birth</label>
              <input
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className="w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Sex</label>
              <div className="grid grid-cols-2 gap-3">
                {(['male', 'female'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    className={`py-3 px-4 rounded-lg border-2 transition-colors capitalize ${
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
          </div>
        )}

        {step === 'body' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Scale className="w-12 h-12 mx-auto text-primary-500 mb-3" />
              <h2 className="text-xl font-semibold">Your Body</h2>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Height (cm)</label>
              <input
                type="number"
                value={heightCm}
                onChange={e => setHeightCm(e.target.value)}
                placeholder="170"
                className="w-full"
                min="100"
                max="250"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Current Weight (kg)</label>
              <input
                type="number"
                value={currentWeight}
                onChange={e => {
                  setCurrentWeight(e.target.value)
                  // Auto-fill target weight if losing
                  if (!targetWeight && e.target.value) {
                    setTargetWeight(String(Math.round((parseFloat(e.target.value) - 5) * 10) / 10))
                  }
                }}
                placeholder="75"
                className="w-full"
                step="0.1"
                min="30"
                max="300"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Activity Level</label>
              <div className="space-y-2">
                {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setActivityLevel(level)}
                    className={`w-full text-left py-3 px-4 rounded-lg border-2 transition-colors ${
                      activityLevel === level
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-slate-700'
                    }`}
                  >
                    <div className={activityLevel === level ? 'text-primary-400' : 'text-slate-200'}>
                      {ACTIVITY_LABELS[level].label}
                    </div>
                    <div className="text-sm text-slate-500">
                      {ACTIVITY_LABELS[level].desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'goal' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Target className="w-12 h-12 mx-auto text-primary-500 mb-3" />
              <h2 className="text-xl font-semibold">Your Goal</h2>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Goal Type</label>
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
                    className={`py-3 px-4 rounded-lg border-2 transition-colors ${
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
                  <label className="block text-sm text-slate-400 mb-2">Target Weight (kg)</label>
                  <input
                    type="number"
                    value={targetWeight}
                    onChange={e => setTargetWeight(e.target.value)}
                    placeholder="70"
                    className="w-full"
                    step="0.1"
                    min="30"
                    max="300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Target Date</label>
                  <input
                    type="date"
                    value={targetDate || getDefaultTargetDate()}
                    onChange={e => setTargetDate(e.target.value)}
                    className="w-full"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </>
            )}

            {goalType === 'maintain' && (
              <div className="card bg-slate-800/50">
                <p className="text-slate-400 text-sm">
                  We'll calculate your maintenance calories based on your current weight and activity level.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-8 safe-bottom">
        {step !== 'basics' && (
          <button
            type="button"
            onClick={() => setStep(step === 'goal' ? 'body' : 'basics')}
            className="btn btn-secondary flex-1"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
        )}

        {step !== 'goal' ? (
          <button
            type="button"
            onClick={() => setStep(step === 'basics' ? 'body' : 'goal')}
            disabled={
              (step === 'basics' && !birthDate) ||
              (step === 'body' && (!heightCm || !currentWeight))
            }
            className="btn btn-primary flex-1"
          >
            Next
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || (goalType !== 'maintain' && (!targetWeight || !targetDate))}
            className="btn btn-primary flex-1"
          >
            {isSubmitting ? 'Saving...' : 'Get Started'}
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}
