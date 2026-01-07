import type { FoodItem, NutritionData, OpenFoodFactsProduct } from '../types'
import { generateId } from '../db'

const OFF_BASE_URL = 'https://world.openfoodfacts.org'

// Caching for search results
const searchCache = new Map<string, { results: FoodItem[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Rate limiting - prevent hammering the API
const MIN_REQUEST_INTERVAL = 300 // ms between requests
let lastOFFRequest = 0

/**
 * Wait for rate limit before making a request
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSince = now - lastOFFRequest

  if (timeSince < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSince))
  }

  lastOFFRequest = Date.now()
}

/**
 * Search Open Food Facts by barcode
 */
export async function searchByBarcode(barcode: string): Promise<FoodItem | null> {
  try {
    await waitForRateLimit()

    const response = await fetch(
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
 * Supports AbortSignal for cancellation
 */
async function searchOpenFoodFacts(
  query: string,
  limit: number = 20,
  signal?: AbortSignal
): Promise<FoodItem[]> {
  try {
    await waitForRateLimit()

    // Check if already aborted before making request
    if (signal?.aborted) {
      return []
    }

    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: limit.toString(),
      fields: 'code,product_name,brands,serving_size,serving_quantity,nutriments,image_url'
    })

    const response = await fetch(`${OFF_BASE_URL}/cgi/search.pl?${params}`, {
      headers: {
        'User-Agent': 'CalTrack/1.0 (personal calorie tracker)'
      },
      signal
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
    // Don't log abort errors - they're expected
    if (error instanceof Error && error.name === 'AbortError') {
      return []
    }
    console.error('Error searching Open Food Facts:', error)
    return []
  }
}

/**
 * Search foods using Open Food Facts
 *
 * Supports AbortSignal for cancelling in-flight requests.
 * Uses caching to reduce API calls.
 *
 * Note: USDA FoodData Central removed - their DEMO_KEY only allows 10 requests/hour
 * which is completely inadequate for real-time search-as-you-type functionality.
 */
export async function searchFoods(
  query: string,
  limit: number = 20,
  signal?: AbortSignal
): Promise<FoodItem[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return []
  }

  const cacheKey = `${trimmedQuery.toLowerCase()}-${limit}`

  // Check cache first
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results
  }

  // Check if already aborted
  if (signal?.aborted) {
    return []
  }

  // Search Open Food Facts
  const results = await searchOpenFoodFacts(trimmedQuery, limit, signal)

  // Cache results (but not if aborted)
  if (!signal?.aborted && results.length > 0) {
    searchCache.set(cacheKey, { results, timestamp: Date.now() })
  }

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
