import type { FoodItem, NutritionData, OpenFoodFactsProduct, USDAFoodSearchResult, USDAFood } from '../types'
import { generateId } from '../db'

const OFF_BASE_URL = 'https://world.openfoodfacts.org'
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
const USDA_API_KEY = 'DEMO_KEY' // Works for low volume, user can add their own

// USDA nutrient IDs
const NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
  fiber: 1079,
  sugar: 2000,
  sodium: 1093,
  saturatedFat: 1258
}

// Rate limiting and caching
const searchCache = new Map<string, { results: FoodItem[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MIN_REQUEST_INTERVAL = 500 // ms between requests to same API
let lastOFFRequest = 0
let lastUSDARequest = 0

/**
 * Wait for rate limit
 */
async function waitForRateLimit(api: 'off' | 'usda'): Promise<void> {
  const now = Date.now()
  const lastRequest = api === 'off' ? lastOFFRequest : lastUSDARequest
  const timeSince = now - lastRequest

  if (timeSince < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSince))
  }

  if (api === 'off') {
    lastOFFRequest = Date.now()
  } else {
    lastUSDARequest = Date.now()
  }
}

/**
 * Fetch with retry and exponential backoff for rate limits
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000)
        console.warn(`Rate limited, waiting ${backoffMs}ms before retry`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        continue
      }

      return response
    } catch (error) {
      lastError = error as Error
      // Network error - wait and retry
      const backoffMs = 1000 * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }

  throw lastError || new Error('Request failed after retries')
}

/**
 * Search Open Food Facts by barcode
 */
export async function searchByBarcode(barcode: string): Promise<FoodItem | null> {
  try {
    await waitForRateLimit('off')

    const response = await fetchWithRetry(
      `${OFF_BASE_URL}/api/v2/product/${barcode}?fields=code,product_name,brands,serving_size,serving_quantity,nutriments,image_url`,
      {
        headers: {
          'User-Agent': 'CalTrack/1.0 (personal calorie tracker)'
        }
      }
    )

    if (!response.ok) {
      return null
    }

    const data: OpenFoodFactsProduct = await response.json()

    if (data.status !== 1 || !data.product?.product_name) {
      return null
    }

    return mapOpenFoodFactsToFoodItem(data, barcode)
  } catch (error) {
    console.error('Error fetching from Open Food Facts:', error)
    return null
  }
}

/**
 * Search Open Food Facts by text query
 */
export async function searchOpenFoodFacts(query: string, limit: number = 15): Promise<FoodItem[]> {
  try {
    await waitForRateLimit('off')

    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: limit.toString(),
      fields: 'code,product_name,brands,serving_size,serving_quantity,nutriments,image_url'
    })

    const response = await fetchWithRetry(`${OFF_BASE_URL}/cgi/search.pl?${params}`, {
      headers: {
        'User-Agent': 'CalTrack/1.0 (personal calorie tracker)'
      }
    })

    if (!response.ok) {
      console.warn('Open Food Facts search failed:', response.status)
      return []
    }

    const data = await response.json()
    const products: OpenFoodFactsProduct[] = data.products || []

    return products
      .filter(p => p.product?.product_name && p.product?.nutriments?.['energy-kcal_100g'])
      .map(p => mapOpenFoodFactsToFoodItem(p, p.code))
      .filter((item): item is FoodItem => item !== null)
  } catch (error) {
    console.error('Error searching Open Food Facts:', error)
    return []
  }
}

/**
 * Search USDA FoodData Central
 */
export async function searchUSDA(query: string, limit: number = 15): Promise<FoodItem[]> {
  try {
    await waitForRateLimit('usda')

    const params = new URLSearchParams({
      query,
      pageSize: limit.toString(),
      api_key: USDA_API_KEY,
      dataType: 'Branded,Foundation,SR Legacy' // Include common food types
    })

    const response = await fetchWithRetry(`${USDA_BASE_URL}/foods/search?${params}`)

    if (!response.ok) {
      console.warn('USDA search failed:', response.status)
      return []
    }

    const data: USDAFoodSearchResult = await response.json()

    return data.foods
      .map(mapUSDAToFoodItem)
      .filter((item): item is FoodItem => item !== null)
  } catch (error) {
    console.error('Error searching USDA:', error)
    return []
  }
}

/**
 * Combined search with caching and fallback
 * - Checks cache first
 * - Tries USDA first (more reliable rate limits)
 * - Falls back to Open Food Facts if needed
 * - Caches results
 */
export async function searchFoods(query: string, limit: number = 20): Promise<FoodItem[]> {
  const cacheKey = `${query.toLowerCase().trim()}-${limit}`

  // Check cache
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results
  }

  // Try USDA first (generally more reliable)
  let results: FoodItem[] = []

  try {
    const usdaResults = await searchUSDA(query, limit)
    results = usdaResults
  } catch (error) {
    console.warn('USDA search failed, trying Open Food Facts')
  }

  // If we don't have enough results, supplement with Open Food Facts
  if (results.length < limit) {
    try {
      const offResults = await searchOpenFoodFacts(query, limit - results.length)

      // Dedupe by name similarity and merge
      const existingNames = new Set(results.map(r => r.name.toLowerCase()))
      const newResults = offResults.filter(r => !existingNames.has(r.name.toLowerCase()))
      results = [...results, ...newResults].slice(0, limit)
    } catch (error) {
      console.warn('Open Food Facts search also failed')
    }
  }

  // Cache results
  searchCache.set(cacheKey, { results, timestamp: Date.now() })

  return results
}

/**
 * Clear search cache (useful when debugging)
 */
export function clearSearchCache(): void {
  searchCache.clear()
}

/**
 * Map Open Food Facts product to our FoodItem type
 * Improved serving size handling
 */
function mapOpenFoodFactsToFoodItem(data: OpenFoodFactsProduct, barcode: string): FoodItem | null {
  const product = data.product
  if (!product?.product_name) {
    return null
  }

  const nutriments = product.nutriments || {}

  // Parse serving information more intelligently
  const servingInfo = parseServingInfo(product.serving_size, product.serving_quantity)

  // Determine if we have per-serving nutrition data
  const hasServingData = nutriments['energy-kcal_serving'] !== undefined

  // Calculate nutrition based on serving
  let nutrition: NutritionData

  if (hasServingData && servingInfo.size > 0) {
    // Use per-serving data directly
    nutrition = {
      calories: Math.round(nutriments['energy-kcal_serving'] ?? 0),
      protein: round1(nutriments['proteins_serving'] ?? 0),
      carbs: round1(nutriments['carbohydrates_serving'] ?? 0),
      fat: round1(nutriments['fat_serving'] ?? 0),
      fiber: nutriments['fiber_serving'] ? round1(nutriments['fiber_serving']) : undefined,
      sugar: nutriments['sugars_serving'] ? round1(nutriments['sugars_serving']) : undefined,
      sodium: nutriments['sodium_serving'] ? Math.round(nutriments['sodium_serving'] * 1000) : undefined
    }
  } else {
    // Use per-100g data, scaled to serving size
    const scale = servingInfo.size / 100
    nutrition = {
      calories: Math.round((nutriments['energy-kcal_100g'] ?? 0) * scale),
      protein: round1((nutriments.proteins_100g ?? 0) * scale),
      carbs: round1((nutriments.carbohydrates_100g ?? 0) * scale),
      fat: round1((nutriments.fat_100g ?? 0) * scale),
      fiber: nutriments.fiber_100g ? round1(nutriments.fiber_100g * scale) : undefined,
      sugar: nutriments.sugars_100g ? round1(nutriments.sugars_100g * scale) : undefined,
      sodium: nutriments.sodium_100g ? Math.round(nutriments.sodium_100g * 1000 * scale) : undefined
    }
  }

  // Skip items with no calorie data
  if (nutrition.calories === 0 && nutrition.protein === 0 && nutrition.carbs === 0 && nutrition.fat === 0) {
    return null
  }

  return {
    id: `off-${barcode}`,
    source: 'openfoodfacts',
    sourceId: barcode,
    name: product.product_name,
    brand: product.brands?.split(',')[0]?.trim(),
    servingSize: servingInfo.size,
    servingUnit: servingInfo.unit,
    servingDescription: servingInfo.description,
    nutrition,
    nutritionPer100g: {
      calories: Math.round(nutriments['energy-kcal_100g'] ?? 0),
      protein: round1(nutriments.proteins_100g ?? 0),
      carbs: round1(nutriments.carbohydrates_100g ?? 0),
      fat: round1(nutriments.fat_100g ?? 0)
    },
    imageUrl: product.image_url,
    createdAt: new Date().toISOString()
  }
}

/**
 * Parse serving size information from various formats
 */
function parseServingInfo(servingSize?: string, servingQuantity?: number): {
  size: number
  unit: string
  description: string
} {
  // Default to 100g
  if (!servingSize && !servingQuantity) {
    return { size: 100, unit: 'g', description: '100g' }
  }

  // If we have a numeric quantity, use it
  if (servingQuantity && servingQuantity > 0) {
    const unit = parseServingUnit(servingSize || '')
    return {
      size: servingQuantity,
      unit,
      description: servingSize || `${servingQuantity}${unit}`
    }
  }

  if (!servingSize) {
    return { size: 100, unit: 'g', description: '100g' }
  }

  // Parse strings like "30g", "1 cup (240ml)", "2 pieces (50g)", "1 slice (28g)"
  // Try to extract grams first
  const gramsMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?/i)
  if (gramsMatch?.[1]) {
    return {
      size: parseFloat(gramsMatch[1]),
      unit: 'g',
      description: servingSize
    }
  }

  // Try to extract ml
  const mlMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*ml/i)
  if (mlMatch?.[1]) {
    return {
      size: parseFloat(mlMatch[1]),
      unit: 'ml',
      description: servingSize
    }
  }

  // Try to extract oz
  const ozMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*oz/i)
  if (ozMatch?.[1]) {
    return {
      size: parseFloat(ozMatch[1]),
      unit: 'oz',
      description: servingSize
    }
  }

  // Try to extract a leading number
  const numberMatch = servingSize.match(/^(\d+(?:\.\d+)?)\s*(.*)/)
  if (numberMatch?.[1]) {
    const num = parseFloat(numberMatch[1])
    const rest = numberMatch[2]?.trim() || 'serving'
    return {
      size: num,
      unit: rest.split(/\s+/)[0] || 'serving',
      description: servingSize
    }
  }

  // Default
  return { size: 1, unit: 'serving', description: servingSize }
}

/**
 * Map USDA food to our FoodItem type
 */
function mapUSDAToFoodItem(food: USDAFood): FoodItem | null {
  const getNutrient = (id: number): number => {
    const nutrient = food.foodNutrients.find(n => n.nutrientId === id)
    return nutrient?.value ?? 0
  }

  // USDA provides nutrition per 100g, but also includes serving size info
  const per100g: NutritionData = {
    calories: Math.round(getNutrient(NUTRIENT_IDS.calories)),
    protein: round1(getNutrient(NUTRIENT_IDS.protein)),
    carbs: round1(getNutrient(NUTRIENT_IDS.carbs)),
    fat: round1(getNutrient(NUTRIENT_IDS.fat)),
    fiber: getNutrient(NUTRIENT_IDS.fiber) || undefined,
    sugar: getNutrient(NUTRIENT_IDS.sugar) || undefined,
    sodium: Math.round(getNutrient(NUTRIENT_IDS.sodium)) || undefined
  }

  // Skip items with no meaningful nutrition data
  if (per100g.calories === 0 && per100g.protein === 0 && per100g.carbs === 0 && per100g.fat === 0) {
    return null
  }

  // Get serving size - USDA often provides this
  const servingSize = food.servingSize || 100
  const servingUnit = food.servingSizeUnit?.toLowerCase() || 'g'

  // Scale nutrition to serving size
  const scale = servingSize / 100
  const nutrition: NutritionData = {
    calories: Math.round(per100g.calories * scale),
    protein: round1(per100g.protein * scale),
    carbs: round1(per100g.carbs * scale),
    fat: round1(per100g.fat * scale),
    fiber: per100g.fiber ? round1(per100g.fiber * scale) : undefined,
    sugar: per100g.sugar ? round1(per100g.sugar * scale) : undefined,
    sodium: per100g.sodium ? Math.round(per100g.sodium * scale) : undefined
  }

  return {
    id: `usda-${food.fdcId}`,
    source: 'usda',
    sourceId: food.fdcId.toString(),
    name: food.description,
    brand: food.brandName || food.brandOwner,
    servingSize,
    servingUnit,
    servingDescription: `${servingSize}${servingUnit}`,
    nutrition,
    nutritionPer100g: per100g,
    createdAt: new Date().toISOString()
  }
}

/**
 * Create a quick-add food item (calories only or with macros)
 */
export function createQuickAddFood(
  calories: number,
  name?: string,
  macros?: { protein?: number; carbs?: number; fat?: number }
): FoodItem {
  return {
    id: generateId(),
    source: 'quick',
    name: name || `Quick add (${calories} cal)`,
    servingSize: 1,
    servingUnit: 'serving',
    nutrition: {
      calories,
      protein: macros?.protein ?? 0,
      carbs: macros?.carbs ?? 0,
      fat: macros?.fat ?? 0
    },
    createdAt: new Date().toISOString()
  }
}

/**
 * Parse serving unit from serving size string
 */
function parseServingUnit(servingSize: string): string {
  // Try to extract unit from strings like "30g", "1 cup (240ml)", "2 pieces"
  const match = servingSize.match(/\d+\s*([a-zA-Z]+)/)
  if (match?.[1]) {
    return match[1].toLowerCase()
  }
  return 'serving'
}

/**
 * Round to 1 decimal place
 */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}
