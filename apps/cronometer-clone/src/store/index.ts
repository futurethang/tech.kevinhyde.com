import { create } from 'zustand'
import type { UserProfile, WeightEntry, DiaryEntry, FoodItem, MealType, DailyStats, UserMetrics, SavedFood } from '../types'
import * as db from '../db'
import { calculateDailyStats, calculateUserMetrics, getTodayDate } from '../utils/calculations'

interface AppState {
  // Data
  profile: UserProfile | null
  latestWeight: WeightEntry | null
  currentDate: string
  diaryEntries: DiaryEntry[]
  recentFoods: SavedFood[]
  waterOz: number

  // Computed
  metrics: UserMetrics | null
  dailyStats: DailyStats | null

  // UI State
  isLoading: boolean
  isOnboarding: boolean

  // Actions
  initialize: () => Promise<void>
  setProfile: (profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  addWeight: (weightKg: number, note?: string) => Promise<void>
  setCurrentDate: (date: string) => void
  loadDiaryForDate: (date: string) => Promise<void>
  addFoodToDiary: (food: FoodItem, meal: MealType, servings: number) => Promise<void>
  removeDiaryEntry: (id: string) => Promise<void>
  updateServings: (id: string, servings: number) => Promise<void>
  loadRecentFoods: () => Promise<void>
  toggleFavorite: (foodId: string) => Promise<void>
  addWater: (amountOz: number) => Promise<void>
  refreshDailyStats: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  profile: null,
  latestWeight: null,
  currentDate: getTodayDate(),
  diaryEntries: [],
  recentFoods: [],
  waterOz: 0,
  metrics: null,
  dailyStats: null,
  isLoading: true,
  isOnboarding: false,

  // Initialize app - load data from IndexedDB
  initialize: async () => {
    set({ isLoading: true })

    try {
      const [profile, latestWeight, recentFoods] = await Promise.all([
        db.getProfile(),
        db.getLatestWeight(),
        db.getRecentFoods(30)
      ])

      if (!profile) {
        set({ isLoading: false, isOnboarding: true })
        return
      }

      const metrics = calculateUserMetrics(profile, latestWeight ?? undefined)
      const currentDate = getTodayDate()
      const [entries, waterOz] = await Promise.all([
        db.getDiaryEntriesForDate(currentDate),
        db.getTotalWaterForDate(currentDate)
      ])
      const dailyStats = calculateDailyStats(
        currentDate,
        entries,
        metrics.dailyCalorieTarget,
        waterOz,
        profile.waterGoalOz
      )

      set({
        profile,
        latestWeight,
        metrics,
        currentDate,
        diaryEntries: entries,
        dailyStats,
        recentFoods,
        waterOz,
        isLoading: false,
        isOnboarding: false
      })
    } catch (error) {
      console.error('Failed to initialize:', error)
      set({ isLoading: false, isOnboarding: true })
    }
  },

  // Save or update profile
  setProfile: async (profileData) => {
    const profile = await db.saveProfile(profileData)
    const { latestWeight, currentDate, diaryEntries, waterOz } = get()
    const metrics = calculateUserMetrics(profile, latestWeight ?? undefined)

    set({ profile, metrics, isOnboarding: false })

    // Recalculate daily stats with new target
    const dailyStats = calculateDailyStats(
      currentDate,
      diaryEntries,
      metrics.dailyCalorieTarget,
      waterOz,
      profile.waterGoalOz
    )
    set({ dailyStats })
  },

  // Add weight entry
  addWeight: async (weightKg, note) => {
    const entry = await db.addWeightEntry(weightKg, getTodayDate(), note)
    const { profile, currentDate, diaryEntries, waterOz } = get()

    if (profile) {
      const metrics = calculateUserMetrics(profile, entry)
      const dailyStats = calculateDailyStats(
        currentDate,
        diaryEntries,
        metrics.dailyCalorieTarget,
        waterOz,
        profile.waterGoalOz
      )
      set({ latestWeight: entry, metrics, dailyStats })
    } else {
      set({ latestWeight: entry })
    }
  },

  // Change current date view
  setCurrentDate: (date) => {
    set({ currentDate: date })
    get().loadDiaryForDate(date)
  },

  // Load diary entries for a specific date
  loadDiaryForDate: async (date) => {
    const { profile, metrics } = get()
    const [entries, waterOz] = await Promise.all([
      db.getDiaryEntriesForDate(date),
      db.getTotalWaterForDate(date)
    ])
    const dailyStats = calculateDailyStats(
      date,
      entries,
      metrics?.dailyCalorieTarget || 2000,
      waterOz,
      profile?.waterGoalOz || 64
    )
    set({ diaryEntries: entries, dailyStats, waterOz })
  },

  // Add food to diary
  addFoodToDiary: async (food, meal, servings) => {
    const { currentDate, metrics, profile, waterOz } = get()

    const entry = await db.addDiaryEntry({
      date: currentDate,
      meal,
      foodId: food.id,
      food,
      servings
    })

    const entries = [...get().diaryEntries, entry]
    const dailyStats = calculateDailyStats(
      currentDate,
      entries,
      metrics?.dailyCalorieTarget || 2000,
      waterOz,
      profile?.waterGoalOz || 64
    )

    // Refresh recent foods
    const recentFoods = await db.getRecentFoods(30)

    set({ diaryEntries: entries, dailyStats, recentFoods })
  },

  // Remove diary entry
  removeDiaryEntry: async (id) => {
    await db.deleteDiaryEntry(id)
    const { currentDate, metrics, profile, waterOz } = get()
    const entries = get().diaryEntries.filter(e => e.id !== id)
    const dailyStats = calculateDailyStats(
      currentDate,
      entries,
      metrics?.dailyCalorieTarget || 2000,
      waterOz,
      profile?.waterGoalOz || 64
    )
    set({ diaryEntries: entries, dailyStats })
  },

  // Update servings for an entry
  updateServings: async (id, servings) => {
    await db.updateDiaryEntryServings(id, servings)
    const { currentDate, metrics, profile, waterOz } = get()
    const entries = get().diaryEntries.map(e =>
      e.id === id ? { ...e, servings } : e
    )
    const dailyStats = calculateDailyStats(
      currentDate,
      entries,
      metrics?.dailyCalorieTarget || 2000,
      waterOz,
      profile?.waterGoalOz || 64
    )
    set({ diaryEntries: entries, dailyStats })
  },

  // Load recent foods
  loadRecentFoods: async () => {
    const recentFoods = await db.getRecentFoods(30)
    set({ recentFoods })
  },

  // Toggle favorite status
  toggleFavorite: async (foodId) => {
    await db.toggleFavorite(foodId)
    const recentFoods = await db.getRecentFoods(30)
    set({ recentFoods })
  },

  // Add water
  addWater: async (amountOz) => {
    const { currentDate, profile, metrics, diaryEntries, waterOz } = get()
    await db.addWaterEntry(amountOz, currentDate)
    const newWaterOz = waterOz + amountOz
    const dailyStats = calculateDailyStats(
      currentDate,
      diaryEntries,
      metrics?.dailyCalorieTarget || 2000,
      newWaterOz,
      profile?.waterGoalOz || 64
    )
    set({ waterOz: newWaterOz, dailyStats })
  },

  // Refresh daily stats (useful after profile changes)
  refreshDailyStats: async () => {
    const { currentDate, profile, metrics, diaryEntries, waterOz } = get()
    const dailyStats = calculateDailyStats(
      currentDate,
      diaryEntries,
      metrics?.dailyCalorieTarget || 2000,
      waterOz,
      profile?.waterGoalOz || 64
    )
    set({ dailyStats })
  }
}))
