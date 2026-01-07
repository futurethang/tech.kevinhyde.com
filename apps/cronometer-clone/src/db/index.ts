import Dexie, { type EntityTable } from 'dexie'
import type { UserProfile, WeightEntry, DiaryEntry, SavedFood, FoodItem } from '../types'

// Database schema
class CalTrackDB extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>
  weightEntries!: EntityTable<WeightEntry, 'id'>
  diaryEntries!: EntityTable<DiaryEntry, 'id'>
  savedFoods!: EntityTable<SavedFood, 'id'>
  customFoods!: EntityTable<FoodItem, 'id'>

  constructor() {
    super('CalTrackDB')

    this.version(1).stores({
      profile: 'id',
      weightEntries: 'id, date',
      diaryEntries: 'id, date, meal, foodId',
      savedFoods: 'id, lastUsed, usageCount',
      customFoods: 'id, name, source'
    })
  }
}

export const db = new CalTrackDB()

// Helper to generate IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Profile operations
export async function getProfile(): Promise<UserProfile | undefined> {
  return db.profile.toCollection().first()
}

export async function saveProfile(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  const existing = await getProfile()
  const now = new Date().toISOString()

  if (existing) {
    const updated: UserProfile = {
      ...existing,
      ...profile,
      updatedAt: now
    }
    await db.profile.put(updated)
    return updated
  } else {
    const newProfile: UserProfile = {
      ...profile,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    }
    await db.profile.add(newProfile)
    return newProfile
  }
}

// Weight entry operations
export async function addWeightEntry(weightKg: number, date?: string, note?: string): Promise<WeightEntry> {
  const entry: WeightEntry = {
    id: generateId(),
    date: date || new Date().toISOString().split('T')[0]!,
    weightKg,
    note,
    createdAt: new Date().toISOString()
  }
  await db.weightEntries.add(entry)
  return entry
}

export async function getWeightEntries(limit?: number): Promise<WeightEntry[]> {
  let query = db.weightEntries.orderBy('date').reverse()
  if (limit) {
    query = query.limit(limit)
  }
  return query.toArray()
}

export async function getLatestWeight(): Promise<WeightEntry | undefined> {
  return db.weightEntries.orderBy('date').reverse().first()
}

export async function deleteWeightEntry(id: string): Promise<void> {
  await db.weightEntries.delete(id)
}

// Diary entry operations
export async function addDiaryEntry(entry: Omit<DiaryEntry, 'id' | 'createdAt'>): Promise<DiaryEntry> {
  const newEntry: DiaryEntry = {
    ...entry,
    id: generateId(),
    createdAt: new Date().toISOString()
  }
  await db.diaryEntries.add(newEntry)

  // Update saved foods usage
  await updateSavedFoodUsage(entry.food)

  return newEntry
}

export async function getDiaryEntriesForDate(date: string): Promise<DiaryEntry[]> {
  return db.diaryEntries.where('date').equals(date).toArray()
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  await db.diaryEntries.delete(id)
}

export async function updateDiaryEntryServings(id: string, servings: number): Promise<void> {
  await db.diaryEntries.update(id, { servings })
}

// Saved foods operations
export async function updateSavedFoodUsage(food: FoodItem): Promise<void> {
  const existing = await db.savedFoods.where('id').equals(food.id).first()
  const now = new Date().toISOString()

  if (existing) {
    await db.savedFoods.update(food.id, {
      usageCount: existing.usageCount + 1,
      lastUsed: now,
      food // Update in case nutrition data changed
    })
  } else {
    await db.savedFoods.add({
      id: food.id,
      food,
      usageCount: 1,
      lastUsed: now,
      isFavorite: false
    })
  }
}

export async function getRecentFoods(limit: number = 20): Promise<SavedFood[]> {
  return db.savedFoods.orderBy('lastUsed').reverse().limit(limit).toArray()
}

export async function getFrequentFoods(limit: number = 10): Promise<SavedFood[]> {
  return db.savedFoods.orderBy('usageCount').reverse().limit(limit).toArray()
}

export async function getFavoriteFoods(): Promise<SavedFood[]> {
  return db.savedFoods.filter(f => f.isFavorite).toArray()
}

export async function toggleFavorite(foodId: string): Promise<void> {
  const existing = await db.savedFoods.get(foodId)
  if (existing) {
    await db.savedFoods.update(foodId, { isFavorite: !existing.isFavorite })
  }
}

// Custom foods operations
export async function addCustomFood(food: Omit<FoodItem, 'id' | 'createdAt' | 'source'>): Promise<FoodItem> {
  const newFood: FoodItem = {
    ...food,
    id: generateId(),
    source: 'custom',
    createdAt: new Date().toISOString()
  }
  await db.customFoods.add(newFood)
  return newFood
}

export async function getCustomFoods(): Promise<FoodItem[]> {
  return db.customFoods.toArray()
}

export async function searchCustomFoods(query: string): Promise<FoodItem[]> {
  const lowerQuery = query.toLowerCase()
  return db.customFoods
    .filter(f => f.name.toLowerCase().includes(lowerQuery))
    .toArray()
}

// Clear all data (for debugging/reset)
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.profile.clear(),
    db.weightEntries.clear(),
    db.diaryEntries.clear(),
    db.savedFoods.clear(),
    db.customFoods.clear()
  ])
}
