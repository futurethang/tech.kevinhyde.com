import type { ActivityLevel, UserProfile, WeightEntry, DiaryEntry, NutritionData, UserMetrics, DailyStats } from '../types'

// Activity level multipliers for TDEE
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
}

// Calories per kg of body fat
const KCAL_PER_KG_FAT = 7700

// Safety limits
const MIN_CALORIES_FEMALE = 1200
const MIN_CALORIES_MALE = 1500
const MAX_DAILY_DEFICIT = 1000 // ~2 lbs/week

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age
}

/**
 * Calculate BMR using Mifflin-St Jeor equation
 * Male:   BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
 * Female: BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: 'male' | 'female'
): number {
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age)
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel])
}

/**
 * Calculate BMI
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10
}

/**
 * Calculate daily calorie target based on goal
 */
export function calculateDailyTarget(
  profile: UserProfile,
  currentWeightKg: number
): { target: number; deficit: number; daysToGoal: number; warning?: string } {
  const age = calculateAge(profile.birthDate)
  const bmr = calculateBMR(currentWeightKg, profile.heightCm, age, profile.sex)
  const tdee = calculateTDEE(bmr, profile.activityLevel)

  // Maintenance goal
  if (profile.goalType === 'maintain') {
    return { target: tdee, deficit: 0, daysToGoal: 0 }
  }

  const weightDiff = currentWeightKg - profile.targetWeightKg // Positive = losing
  const totalCaloriesToBurn = weightDiff * KCAL_PER_KG_FAT

  const targetDate = new Date(profile.targetDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  targetDate.setHours(0, 0, 0, 0)

  const daysRemaining = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

  let dailyDeficit = Math.round(totalCaloriesToBurn / daysRemaining)
  let warning: string | undefined

  // Apply safety constraints
  const minCalories = profile.sex === 'male' ? MIN_CALORIES_MALE : MIN_CALORIES_FEMALE

  if (profile.goalType === 'lose') {
    // Cap deficit at safe maximum
    if (dailyDeficit > MAX_DAILY_DEFICIT) {
      warning = `Goal requires ${dailyDeficit} kcal/day deficit. Capped at ${MAX_DAILY_DEFICIT} for safety.`
      dailyDeficit = MAX_DAILY_DEFICIT
    }

    const target = tdee - dailyDeficit

    // Ensure minimum calories
    if (target < minCalories) {
      warning = `Target would be ${target} kcal/day. Raised to ${minCalories} minimum.`
      return {
        target: minCalories,
        deficit: tdee - minCalories,
        daysToGoal: Math.ceil(totalCaloriesToBurn / (tdee - minCalories)),
        warning
      }
    }

    // Recalculate days to goal with actual deficit
    const actualDaysToGoal = dailyDeficit > 0
      ? Math.ceil(totalCaloriesToBurn / dailyDeficit)
      : 0

    return { target, deficit: dailyDeficit, daysToGoal: actualDaysToGoal, warning }
  }

  // Gain goal (surplus)
  if (profile.goalType === 'gain') {
    const surplus = Math.abs(dailyDeficit)
    // Cap surplus at reasonable rate (~0.5 kg/week = ~550 kcal/day)
    const cappedSurplus = Math.min(surplus, 550)
    return {
      target: tdee + cappedSurplus,
      deficit: -cappedSurplus,
      daysToGoal: Math.ceil(Math.abs(totalCaloriesToBurn) / cappedSurplus)
    }
  }

  return { target: tdee, deficit: 0, daysToGoal: 0 }
}

/**
 * Calculate full user metrics
 */
export function calculateUserMetrics(
  profile: UserProfile,
  latestWeight: WeightEntry | undefined
): UserMetrics {
  const currentWeightKg = latestWeight?.weightKg ?? profile.targetWeightKg
  const age = calculateAge(profile.birthDate)
  const bmr = calculateBMR(currentWeightKg, profile.heightCm, age, profile.sex)
  const tdee = calculateTDEE(bmr, profile.activityLevel)
  const bmi = calculateBMI(currentWeightKg, profile.heightCm)

  const { target, deficit, daysToGoal } = calculateDailyTarget(profile, currentWeightKg)

  // Weekly weight change (kg)
  // deficit * 7 / KCAL_PER_KG_FAT
  const weeklyWeightChange = (deficit * 7) / KCAL_PER_KG_FAT

  return {
    currentWeightKg,
    bmi,
    bmr,
    tdee,
    dailyCalorieTarget: target,
    dailyDeficit: deficit,
    weeklyWeightChange,
    projectedDaysToGoal: daysToGoal
  }
}

/**
 * Sum nutrition data from multiple entries
 */
export function sumNutrition(entries: DiaryEntry[]): NutritionData {
  const totals: NutritionData = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0
  }

  for (const entry of entries) {
    const mult = entry.servings
    totals.calories += entry.food.nutrition.calories * mult
    totals.protein += entry.food.nutrition.protein * mult
    totals.carbs += entry.food.nutrition.carbs * mult
    totals.fat += entry.food.nutrition.fat * mult
    totals.fiber = (totals.fiber ?? 0) + (entry.food.nutrition.fiber ?? 0) * mult
    totals.sugar = (totals.sugar ?? 0) + (entry.food.nutrition.sugar ?? 0) * mult
    totals.sodium = (totals.sodium ?? 0) + (entry.food.nutrition.sodium ?? 0) * mult
  }

  // Round all values
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    fiber: totals.fiber ? Math.round(totals.fiber * 10) / 10 : undefined,
    sugar: totals.sugar ? Math.round(totals.sugar * 10) / 10 : undefined,
    sodium: totals.sodium ? Math.round(totals.sodium) : undefined
  }
}

/**
 * Calculate daily stats
 */
export function calculateDailyStats(
  date: string,
  entries: DiaryEntry[],
  calorieTarget: number
): DailyStats {
  const totals = sumNutrition(entries)
  const remaining = calorieTarget - totals.calories
  const percentComplete = Math.min(100, Math.round((totals.calories / calorieTarget) * 100))

  return {
    date,
    entries,
    totals,
    calorieTarget,
    remaining,
    percentComplete
  }
}

/**
 * Format weight for display
 */
export function formatWeight(kg: number, unit: 'kg' | 'lbs' = 'kg'): string {
  if (unit === 'lbs') {
    return `${Math.round(kg * 2.20462)} lbs`
  }
  return `${Math.round(kg * 10) / 10} kg`
}

/**
 * Convert lbs to kg
 */
export function lbsToKg(lbs: number): number {
  return lbs / 2.20462
}

/**
 * Convert kg to lbs
 */
export function kgToLbs(kg: number): number {
  return kg * 2.20462
}

/**
 * Format height for display
 */
export function formatHeight(cm: number, unit: 'cm' | 'ft' = 'cm'): string {
  if (unit === 'ft') {
    const totalInches = cm / 2.54
    const feet = Math.floor(totalInches / 12)
    const inches = Math.round(totalInches % 12)
    return `${feet}'${inches}"`
  }
  return `${Math.round(cm)} cm`
}

/**
 * Convert feet/inches to cm
 */
export function ftToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]!
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.getTime() === today.getTime()) {
    return 'Today'
  }
  if (date.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}
