// Activity level multipliers for TDEE calculation
export type ActivityLevel =
  | 'sedentary'      // 1.2
  | 'light'          // 1.375
  | 'moderate'       // 1.55
  | 'active'         // 1.725
  | 'very_active'    // 1.9

export type GoalType = 'lose' | 'maintain' | 'gain'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type FoodSource = 'openfoodfacts' | 'usda' | 'custom' | 'quick'

// User profile and goals
export interface UserProfile {
  id: string
  name: string
  birthDate: string        // ISO date string
  sex: 'male' | 'female'
  heightCm: number
  activityLevel: ActivityLevel
  goalType: GoalType
  targetWeightKg: number
  targetDate: string       // ISO date string
  createdAt: string
  updatedAt: string
}

// Weight log entries
export interface WeightEntry {
  id: string
  date: string             // YYYY-MM-DD
  weightKg: number
  note?: string
  createdAt: string
}

// Nutrition data
export interface NutritionData {
  calories: number
  protein: number          // grams
  carbs: number            // grams
  fat: number              // grams
  fiber?: number           // grams
  sugar?: number           // grams
  sodium?: number          // mg
  saturatedFat?: number    // grams
  cholesterol?: number     // mg
}

// Food item (from API or custom)
export interface FoodItem {
  id: string
  source: FoodSource
  sourceId?: string        // barcode or USDA FDC ID
  name: string
  brand?: string
  servingSize: number
  servingUnit: string
  nutrition: NutritionData
  imageUrl?: string
  createdAt: string
}

// Diary entry for a single food log
export interface DiaryEntry {
  id: string
  date: string             // YYYY-MM-DD
  meal: MealType
  foodId: string
  food: FoodItem           // Denormalized snapshot
  servings: number         // Multiplier
  createdAt: string
}

// Saved/favorite foods for quick access
export interface SavedFood {
  id: string
  food: FoodItem
  usageCount: number
  lastUsed: string
  isFavorite: boolean
}

// Computed daily stats (not stored)
export interface DailyStats {
  date: string
  entries: DiaryEntry[]
  totals: NutritionData
  calorieTarget: number
  remaining: number
  percentComplete: number
}

// Computed user metrics (not stored)
export interface UserMetrics {
  currentWeightKg: number
  bmi: number
  bmr: number
  tdee: number
  dailyCalorieTarget: number
  dailyDeficit: number
  weeklyWeightChange: number  // kg per week
  projectedDaysToGoal: number
}

// API response types
export interface OpenFoodFactsProduct {
  code: string
  product?: {
    product_name?: string
    brands?: string
    serving_size?: string
    serving_quantity?: number
    nutriments?: {
      'energy-kcal_100g'?: number
      'energy-kcal_serving'?: number
      proteins_100g?: number
      proteins_serving?: number
      carbohydrates_100g?: number
      carbohydrates_serving?: number
      fat_100g?: number
      fat_serving?: number
      fiber_100g?: number
      sugars_100g?: number
      sodium_100g?: number
      'saturated-fat_100g'?: number
    }
    image_url?: string
  }
  status: number
  status_verbose?: string
}

export interface USDAFoodSearchResult {
  foods: USDAFood[]
  totalHits: number
  currentPage: number
  totalPages: number
}

export interface USDAFood {
  fdcId: number
  description: string
  brandName?: string
  brandOwner?: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients: USDANutrient[]
}

export interface USDANutrient {
  nutrientId: number
  nutrientName: string
  nutrientNumber: string
  unitName: string
  value: number
}
