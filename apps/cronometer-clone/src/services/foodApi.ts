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

/**
 * Search Open Food Facts by barcode
 */
export async function searchByBarcode(barcode: string): Promise<FoodItem | null> {
  try {
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
 */
export async function searchOpenFoodFacts(query: string, limit: number = 20): Promise<FoodItem[]> {
  try {
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
      }
    })

    if (!response.ok) {
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
export async function searchUSDA(query: string, limit: number = 20): Promise<FoodItem[]> {
  try {
    const params = new URLSearchParams({
      query,
      pageSize: limit.toString(),
      api_key: USDA_API_KEY
    })

    const response = await fetch(`${USDA_BASE_URL}/foods/search?${params}`)

    if (!response.ok) {
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
 * Combined search - searches both APIs and merges results
 */
export async function searchFoods(query: string, limit: number = 20): Promise<FoodItem[]> {
  const [offResults, usdaResults] = await Promise.all([
    searchOpenFoodFacts(query, Math.ceil(limit / 2)),
    searchUSDA(query, Math.ceil(limit / 2))
  ])

  // Interleave results, prioritizing Open Food Facts (usually has better brand data)
  const combined: FoodItem[] = []
  const maxLen = Math.max(offResults.length, usdaResults.length)

  for (let i = 0; i < maxLen && combined.length < limit; i++) {
    if (i < offResults.length) {
      combined.push(offResults[i]!)
    }
    if (i < usdaResults.length && combined.length < limit) {
      combined.push(usdaResults[i]!)
    }
  }

  return combined
}

/**
 * Map Open Food Facts product to our FoodItem type
 */
function mapOpenFoodFactsToFoodItem(data: OpenFoodFactsProduct, barcode: string): FoodItem | null {
  const product = data.product
  if (!product?.product_name) {
    return null
  }

  const nutriments = product.nutriments || {}

  // Determine serving size - prefer serving-based data, fall back to 100g
  const hasServingData = nutriments['energy-kcal_serving'] !== undefined
  const servingSize = hasServingData
    ? (product.serving_quantity || 1)
    : 100
  const servingUnit = hasServingData
    ? parseServingUnit(product.serving_size || '1 serving')
    : 'g'

  // Get nutrition values (per serving or per 100g)
  const suffix = hasServingData ? '_serving' : '_100g'

  const nutrition: NutritionData = {
    calories: Math.round(nutriments[`energy-kcal${suffix}`] ?? nutriments['energy-kcal_100g'] ?? 0),
    protein: round1(nutriments[`proteins${suffix}`] ?? nutriments.proteins_100g ?? 0),
    carbs: round1(nutriments[`carbohydrates${suffix}`] ?? nutriments.carbohydrates_100g ?? 0),
    fat: round1(nutriments[`fat${suffix}`] ?? nutriments.fat_100g ?? 0),
    fiber: nutriments.fiber_100g ? round1(nutriments.fiber_100g * (hasServingData ? servingSize / 100 : 1)) : undefined,
    sugar: nutriments.sugars_100g ? round1(nutriments.sugars_100g * (hasServingData ? servingSize / 100 : 1)) : undefined,
    sodium: nutriments.sodium_100g ? Math.round(nutriments.sodium_100g * 1000 * (hasServingData ? servingSize / 100 : 1)) : undefined
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
    servingSize,
    servingUnit,
    nutrition,
    imageUrl: product.image_url,
    createdAt: new Date().toISOString()
  }
}

/**
 * Map USDA food to our FoodItem type
 */
function mapUSDAToFoodItem(food: USDAFood): FoodItem | null {
  const getNutrient = (id: number): number => {
    const nutrient = food.foodNutrients.find(n => n.nutrientId === id)
    return nutrient?.value ?? 0
  }

  const nutrition: NutritionData = {
    calories: Math.round(getNutrient(NUTRIENT_IDS.calories)),
    protein: round1(getNutrient(NUTRIENT_IDS.protein)),
    carbs: round1(getNutrient(NUTRIENT_IDS.carbs)),
    fat: round1(getNutrient(NUTRIENT_IDS.fat)),
    fiber: getNutrient(NUTRIENT_IDS.fiber) || undefined,
    sugar: getNutrient(NUTRIENT_IDS.sugar) || undefined,
    sodium: Math.round(getNutrient(NUTRIENT_IDS.sodium)) || undefined
  }

  // Skip items with no meaningful nutrition data
  if (nutrition.calories === 0 && nutrition.protein === 0 && nutrition.carbs === 0 && nutrition.fat === 0) {
    return null
  }

  // USDA data is typically per 100g
  const servingSize = food.servingSize || 100
  const servingUnit = food.servingSizeUnit || 'g'

  return {
    id: `usda-${food.fdcId}`,
    source: 'usda',
    sourceId: food.fdcId.toString(),
    name: food.description,
    brand: food.brandName || food.brandOwner,
    servingSize,
    servingUnit,
    nutrition,
    createdAt: new Date().toISOString()
  }
}

/**
 * Create a quick-add food item (calories only)
 */
export function createQuickAddFood(calories: number, name?: string): FoodItem {
  return {
    id: generateId(),
    source: 'quick',
    name: name || `Quick add (${calories} cal)`,
    servingSize: 1,
    servingUnit: 'serving',
    nutrition: {
      calories,
      protein: 0,
      carbs: 0,
      fat: 0
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
