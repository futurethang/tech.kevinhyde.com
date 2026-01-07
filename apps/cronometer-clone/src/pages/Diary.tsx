import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import type { MealType, DiaryEntry } from '../types'
import { formatDate, getTodayDate } from '../utils/calculations'
import {
  Plus,
  Scan,
  ChevronLeft,
  ChevronRight,
  User,
  Scale,
  Trash2,
  Coffee,
  Sun,
  Moon,
  Cookie
} from 'lucide-react'

const MEALS: { type: MealType; label: string; icon: typeof Coffee }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: Coffee },
  { type: 'lunch', label: 'Lunch', icon: Sun },
  { type: 'dinner', label: 'Dinner', icon: Moon },
  { type: 'snack', label: 'Snacks', icon: Cookie }
]

export function Diary() {
  const navigate = useNavigate()
  const {
    currentDate,
    setCurrentDate,
    dailyStats,
    diaryEntries,
    metrics,
    removeDiaryEntry
  } = useStore()

  const isToday = currentDate === getTodayDate()

  const navigateDate = (direction: 'prev' | 'next') => {
    const date = new Date(currentDate)
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
    setCurrentDate(date.toISOString().split('T')[0]!)
  }

  const getEntriesForMeal = (meal: MealType): DiaryEntry[] => {
    return diaryEntries.filter(e => e.meal === meal)
  }

  const getMealCalories = (meal: MealType): number => {
    return getEntriesForMeal(meal).reduce(
      (sum, e) => sum + e.food.nutrition.calories * e.servings,
      0
    )
  }

  const remaining = dailyStats?.remaining ?? 0
  const percentComplete = dailyStats?.percentComplete ?? 0
  const isOverBudget = remaining < 0

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10 safe-top">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 -m-2 text-slate-400 hover:text-slate-200"
          >
            <User className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 text-slate-400 hover:text-slate-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => isToday ? null : setCurrentDate(getTodayDate())}
              className={`font-medium px-3 py-1 rounded-lg ${
                isToday ? 'text-primary-400' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {formatDate(currentDate)}
            </button>
            <button
              onClick={() => navigateDate('next')}
              className="p-2 text-slate-400 hover:text-slate-200"
              disabled={isToday}
            >
              <ChevronRight className={`w-5 h-5 ${isToday ? 'opacity-30' : ''}`} />
            </button>
          </div>

          <button
            onClick={() => navigate('/weight')}
            className="p-2 -m-2 text-slate-400 hover:text-slate-200"
          >
            <Scale className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Calorie Summary */}
      <div className="p-4">
        <div className="card">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-slate-400">Remaining</span>
            <span className="text-sm text-slate-500">
              {dailyStats?.totals.calories ?? 0} / {metrics?.dailyCalorieTarget ?? 2000}
            </span>
          </div>

          <div className={`text-4xl font-bold mb-3 ${
            isOverBudget ? 'text-red-400' : 'text-primary-400'
          }`}>
            {isOverBudget ? '+' : ''}{Math.abs(remaining)} cal
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 animate-progress ${
                isOverBudget ? 'bg-red-500' : percentComplete > 90 ? 'bg-yellow-500' : 'bg-primary-500'
              }`}
              style={{ width: `${Math.min(100, percentComplete)}%` }}
            />
          </div>

          {/* Macros */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
            <MacroDisplay
              label="Protein"
              value={dailyStats?.totals.protein ?? 0}
              unit="g"
              color="text-blue-400"
            />
            <MacroDisplay
              label="Carbs"
              value={dailyStats?.totals.carbs ?? 0}
              unit="g"
              color="text-amber-400"
            />
            <MacroDisplay
              label="Fat"
              value={dailyStats?.totals.fat ?? 0}
              unit="g"
              color="text-rose-400"
            />
          </div>
        </div>
      </div>

      {/* Meals */}
      <div className="flex-1 px-4 space-y-4">
        {MEALS.map(({ type, label, icon: Icon }) => {
          const entries = getEntriesForMeal(type)
          const calories = getMealCalories(type)

          return (
            <div key={type} className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-slate-500" />
                  <span className="font-medium">{label}</span>
                </div>
                <span className="text-slate-400">{calories} cal</span>
              </div>

              {entries.length > 0 && (
                <div className="space-y-2 mb-3">
                  {entries.map(entry => (
                    <DiaryEntryRow
                      key={entry.id}
                      entry={entry}
                      onDelete={() => removeDiaryEntry(entry.id)}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={() => navigate(`/add/${type}`)}
                className="w-full py-2 text-primary-400 hover:bg-slate-700/50 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Food
              </button>
            </div>
          )
        })}
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900 safe-bottom">
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/add/snack')}
            className="btn btn-secondary flex-1"
          >
            <Plus className="w-5 h-5" />
            Quick Add
          </button>
          <button
            onClick={() => navigate('/add/snack?scan=true')}
            className="btn btn-primary flex-1"
          >
            <Scan className="w-5 h-5" />
            Scan
          </button>
        </div>
      </div>
    </div>
  )
}

function MacroDisplay({
  label,
  value,
  unit,
  color
}: {
  label: string
  value: number
  unit: string
  color: string
}) {
  return (
    <div className="text-center">
      <div className={`text-lg font-semibold ${color}`}>
        {Math.round(value * 10) / 10}
        <span className="text-sm font-normal text-slate-500">{unit}</span>
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function DiaryEntryRow({
  entry,
  onDelete
}: {
  entry: DiaryEntry
  onDelete: () => void
}) {
  const calories = Math.round(entry.food.nutrition.calories * entry.servings)
  const servingText = entry.servings === 1
    ? `${entry.food.servingSize} ${entry.food.servingUnit}`
    : `${entry.servings} × ${entry.food.servingSize} ${entry.food.servingUnit}`

  return (
    <div className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-slate-700/30 group">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {entry.food.brand ? `${entry.food.brand} ` : ''}
          {entry.food.name}
        </div>
        <div className="text-sm text-slate-500">{servingText}</div>
      </div>
      <div className="text-slate-300 tabular-nums">{calories}</div>
      <button
        onClick={onDelete}
        className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
