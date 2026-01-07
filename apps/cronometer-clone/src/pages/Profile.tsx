import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import type { ActivityLevel, GoalType, UnitSystem } from '../types'
import { calculateAge, formatWeight, lbsToKg, kgToLbs, ftInToCm, cmToFtIn } from '../utils/calculations'
import { ArrowLeft, Save, Droplets } from 'lucide-react'

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
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(profile?.unitSystem || 'us')

  // Height - stored in display units
  const [heightCm, setHeightCm] = useState('')
  const [heightFeet, setHeightFeet] = useState('')
  const [heightInches, setHeightInches] = useState('')

  // Target weight in display units
  const [targetWeightDisplay, setTargetWeightDisplay] = useState('')

  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activityLevel || 'moderate')
  const [goalType, setGoalType] = useState<GoalType>(profile?.goalType || 'lose')
  const [targetDate, setTargetDate] = useState(profile?.targetDate || '')
  const [waterGoalOz, setWaterGoalOz] = useState(profile?.waterGoalOz?.toString() || '64')

  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form values from profile
  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setBirthDate(profile.birthDate)
      setSex(profile.sex)
      setUnitSystem(profile.unitSystem || 'us')
      setActivityLevel(profile.activityLevel)
      setGoalType(profile.goalType)
      setTargetDate(profile.targetDate)
      setWaterGoalOz((profile.waterGoalOz || 64).toString())

      // Set height based on stored cm
      if (profile.unitSystem === 'us' || !profile.unitSystem) {
        const { feet, inches } = cmToFtIn(profile.heightCm)
        setHeightFeet(feet.toString())
        setHeightInches(inches.toString())
      } else {
        setHeightCm(profile.heightCm.toString())
      }

      // Set target weight based on unit system
      if (profile.unitSystem === 'us' || !profile.unitSystem) {
        setTargetWeightDisplay(Math.round(kgToLbs(profile.targetWeightKg) * 10) / 10 + '')
      } else {
        setTargetWeightDisplay(profile.targetWeightKg.toString())
      }
    }
  }, [profile])

  // Handle unit system change - convert values
  const handleUnitSystemChange = (newSystem: UnitSystem) => {
    if (newSystem === unitSystem) return

    // Convert height
    if (newSystem === 'us' && heightCm) {
      const cm = parseFloat(heightCm)
      if (!isNaN(cm)) {
        const { feet, inches } = cmToFtIn(cm)
        setHeightFeet(feet.toString())
        setHeightInches(inches.toString())
      }
    } else if (newSystem === 'metric') {
      const feet = parseInt(heightFeet) || 0
      const inches = parseInt(heightInches) || 0
      if (feet || inches) {
        setHeightCm(Math.round(ftInToCm(feet, inches)).toString())
      }
    }

    // Convert target weight
    if (targetWeightDisplay) {
      const currentVal = parseFloat(targetWeightDisplay)
      if (!isNaN(currentVal)) {
        if (newSystem === 'us') {
          // Was metric, convert kg to lbs
          setTargetWeightDisplay((Math.round(currentVal * 2.20462 * 10) / 10).toString())
        } else {
          // Was US, convert lbs to kg
          setTargetWeightDisplay((Math.round(currentVal * 0.453592 * 10) / 10).toString())
        }
      }
    }

    setUnitSystem(newSystem)
  }

  // Get height in cm for storage
  const getHeightCm = (): number => {
    if (unitSystem === 'us') {
      const feet = parseInt(heightFeet) || 0
      const inches = parseInt(heightInches) || 0
      return ftInToCm(feet, inches)
    }
    return parseFloat(heightCm) || 0
  }

  // Get target weight in kg for storage
  const getTargetWeightKg = (): number => {
    const val = parseFloat(targetWeightDisplay)
    if (isNaN(val)) return 0
    return unitSystem === 'us' ? lbsToKg(val) : val
  }

  useEffect(() => {
    if (!profile) return
    const currentHeightCm = getHeightCm()
    const currentTargetKg = getTargetWeightKg()

    const changed =
      name !== profile.name ||
      birthDate !== profile.birthDate ||
      sex !== profile.sex ||
      Math.abs(currentHeightCm - profile.heightCm) > 0.5 ||
      activityLevel !== profile.activityLevel ||
      goalType !== profile.goalType ||
      Math.abs(currentTargetKg - profile.targetWeightKg) > 0.05 ||
      targetDate !== profile.targetDate ||
      unitSystem !== (profile.unitSystem || 'us') ||
      parseInt(waterGoalOz) !== (profile.waterGoalOz || 64)

    setHasChanges(changed)
  }, [profile, name, birthDate, sex, heightCm, heightFeet, heightInches, activityLevel, goalType, targetWeightDisplay, targetDate, unitSystem, waterGoalOz])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await setProfile({
        name: name || 'User',
        birthDate,
        sex,
        heightCm: getHeightCm(),
        activityLevel,
        goalType,
        targetWeightKg: getTargetWeightKg(),
        targetDate,
        unitSystem,
        waterGoalOz: parseInt(waterGoalOz) || 64
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
              value={formatWeight(metrics.currentWeightKg, unitSystem)}
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
          {/* Units & Preferences */}
          <section className="card space-y-4">
            <h2 className="font-medium text-slate-300">Preferences</h2>

            <div>
              <label className="block text-sm text-slate-500 mb-2">Unit System</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUnitSystemChange('us')}
                  className={`py-2 px-4 rounded-lg border-2 ${
                    unitSystem === 'us'
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  US (lbs, ft)
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitSystemChange('metric')}
                  className={`py-2 px-4 rounded-lg border-2 ${
                    unitSystem === 'metric'
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  Metric (kg, cm)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-2">
                <Droplets className="w-4 h-4 inline mr-1 text-cyan-400" />
                Daily Water Goal
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['48', '64', '80', '96'].map(oz => (
                  <button
                    key={oz}
                    type="button"
                    onClick={() => setWaterGoalOz(oz)}
                    className={`py-2 px-3 rounded-lg border-2 transition-colors ${
                      waterGoalOz === oz
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    {oz}oz
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                64oz (8 cups) is a common recommendation
              </p>
            </div>
          </section>

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

            {/* Height - conditional based on unit system */}
            {unitSystem === 'us' ? (
              <div>
                <label className="block text-sm text-slate-500 mb-1">Height</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="number"
                      value={heightFeet}
                      onChange={e => setHeightFeet(e.target.value)}
                      placeholder="5"
                      className="w-full pr-10"
                      min="3"
                      max="8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">ft</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={heightInches}
                      onChange={e => setHeightInches(e.target.value)}
                      placeholder="10"
                      className="w-full pr-10"
                      min="0"
                      max="11"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">in</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm text-slate-500 mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  placeholder="170"
                  className="w-full"
                  min="100"
                  max="250"
                />
              </div>
            )}
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
                  <label className="block text-sm text-slate-500 mb-1">
                    Target Weight ({unitSystem === 'us' ? 'lbs' : 'kg'})
                  </label>
                  <input
                    type="number"
                    value={targetWeightDisplay}
                    onChange={e => setTargetWeightDisplay(e.target.value)}
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
