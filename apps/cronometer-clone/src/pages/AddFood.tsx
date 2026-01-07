import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { searchFoods, searchByBarcode, createQuickAddFood } from '../services/foodApi'
import type { FoodItem, MealType } from '../types'
import {
  ArrowLeft,
  Search,
  X,
  Star,
  Clock,
  Plus,
  Minus,
  Loader2,
  Camera
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'

export function AddFood() {
  const navigate = useNavigate()
  const { meal } = useParams<{ meal: MealType }>()
  const [searchParams] = useSearchParams()
  const shouldScan = searchParams.get('scan') === 'true'

  const { addFoodToDiary, recentFoods, toggleFavorite } = useStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null)
  const [servings, setServings] = useState(1)
  const [showScanner, setShowScanner] = useState(shouldScan)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickCalories, setQuickCalories] = useState('')
  const [quickName, setQuickName] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const abortControllerRef = useRef<AbortController | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  // Debounced search with AbortController for cancellation
  useEffect(() => {
    // Clear any pending timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setResults([])
      setIsSearching(false)
      return
    }

    // Debounce for 500ms before searching
    searchTimeoutRef.current = setTimeout(async () => {
      // Create new AbortController for this request
      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsSearching(true)

      try {
        const foods = await searchFoods(trimmedQuery, 20, controller.signal)

        // Only update results if this request wasn't aborted
        if (!controller.signal.aborted) {
          setResults(foods)
        }
      } catch (error) {
        // Don't log abort errors - they're expected
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Search failed:', error)
        }
      } finally {
        // Only clear loading state if this is still the active request
        if (abortControllerRef.current === controller) {
          setIsSearching(false)
        }
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query])

  // Barcode scanner
  useEffect(() => {
    if (!showScanner) return

    const scannerId = 'barcode-scanner'

    const startScanner = async () => {
      try {
        scannerRef.current = new Html5Qrcode(scannerId)

        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777
          },
          async (decodedText) => {
            // Stop scanner immediately
            if (scannerRef.current) {
              await scannerRef.current.stop()
              scannerRef.current = null
            }
            setShowScanner(false)

            // Look up the barcode
            setIsSearching(true)
            const food = await searchByBarcode(decodedText)
            setIsSearching(false)

            if (food) {
              setSelectedFood(food)
              setServings(1)
            } else {
              setScanError(`Product not found for barcode: ${decodedText}`)
              setTimeout(() => setScanError(null), 3000)
            }
          },
          () => {} // Ignore errors during scanning
        )
      } catch (err) {
        console.error('Failed to start scanner:', err)
        setScanError('Camera access denied. Please enable camera permissions.')
        setShowScanner(false)
      }
    }

    startScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [showScanner])

  const handleAddFood = async () => {
    if (!selectedFood || !meal) return

    await addFoodToDiary(selectedFood, meal, servings)
    navigate('/')
  }

  const handleQuickAdd = async () => {
    if (!quickCalories || !meal) return

    const food = createQuickAddFood(parseInt(quickCalories), quickName || undefined)
    await addFoodToDiary(food, meal, 1)
    navigate('/')
  }

  const handleSelectRecent = (food: FoodItem) => {
    setSelectedFood(food)
    setServings(1)
    setQuery('')
    setResults([])
  }

  // Food selection view
  if (selectedFood) {
    const totalCalories = Math.round(selectedFood.nutrition.calories * servings)

    return (
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center gap-3 p-4 border-b border-slate-800">
          <button
            onClick={() => setSelectedFood(null)}
            className="p-2 -m-2 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-medium flex-1 truncate">
            {selectedFood.brand ? `${selectedFood.brand} ` : ''}{selectedFood.name}
          </h1>
        </header>

        <div className="flex-1 p-4 space-y-6">
          {/* Serving selector */}
          <div className="card">
            <label className="block text-sm text-slate-400 mb-3">Servings</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setServings(Math.max(0.25, servings - 0.25))}
                className="btn btn-secondary p-3"
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="flex-1 text-center">
                <div className="text-3xl font-bold">{servings}</div>
                <div className="text-sm text-slate-500">
                  {selectedFood.servingSize * servings} {selectedFood.servingUnit}
                </div>
              </div>
              <button
                onClick={() => setServings(servings + 0.25)}
                className="btn btn-secondary p-3"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Nutrition info */}
          <div className="card">
            <h3 className="font-medium mb-4">Nutrition</h3>
            <div className="space-y-3">
              <NutritionRow label="Calories" value={totalCalories} unit="cal" highlight />
              <NutritionRow
                label="Protein"
                value={Math.round(selectedFood.nutrition.protein * servings * 10) / 10}
                unit="g"
              />
              <NutritionRow
                label="Carbs"
                value={Math.round(selectedFood.nutrition.carbs * servings * 10) / 10}
                unit="g"
              />
              <NutritionRow
                label="Fat"
                value={Math.round(selectedFood.nutrition.fat * servings * 10) / 10}
                unit="g"
              />
              {selectedFood.nutrition.fiber && (
                <NutritionRow
                  label="Fiber"
                  value={Math.round(selectedFood.nutrition.fiber * servings * 10) / 10}
                  unit="g"
                />
              )}
            </div>
          </div>
        </div>

        <div className="p-4 safe-bottom">
          <button onClick={handleAddFood} className="btn btn-primary w-full text-lg py-4">
            Add {totalCalories} cal
          </button>
        </div>
      </div>
    )
  }

  // Scanner view
  if (showScanner) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <header className="flex items-center gap-3 p-4 bg-black/50 absolute top-0 left-0 right-0 z-10">
          <button
            onClick={() => setShowScanner(false)}
            className="p-2 -m-2 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-medium text-white">Scan Barcode</h1>
        </header>

        <div className="flex-1 flex items-center justify-center">
          <div id="barcode-scanner" className="w-full max-w-md" />
        </div>

        <div className="p-4 text-center text-white/70 absolute bottom-0 left-0 right-0 safe-bottom">
          Point your camera at a barcode
        </div>
      </div>
    )
  }

  // Quick add view
  if (showQuickAdd) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center gap-3 p-4 border-b border-slate-800">
          <button
            onClick={() => setShowQuickAdd(false)}
            className="p-2 -m-2 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-medium">Quick Add</h1>
        </header>

        <div className="flex-1 p-4 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Calories</label>
            <input
              type="number"
              value={quickCalories}
              onChange={e => setQuickCalories(e.target.value)}
              placeholder="Enter calories"
              className="w-full text-2xl text-center"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Name (optional)</label>
            <input
              type="text"
              value={quickName}
              onChange={e => setQuickName(e.target.value)}
              placeholder="What did you eat?"
              className="w-full"
            />
          </div>
        </div>

        <div className="p-4 safe-bottom">
          <button
            onClick={handleQuickAdd}
            disabled={!quickCalories}
            className="btn btn-primary w-full text-lg py-4"
          >
            Add {quickCalories || 0} cal
          </button>
        </div>
      </div>
    )
  }

  // Main search view
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -m-2 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-medium capitalize">{meal}</h1>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search foods..."
            className="w-full pl-10 pr-4"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowScanner(true)}
            className="btn btn-secondary flex-1"
          >
            <Camera className="w-5 h-5" />
            Scan
          </button>
          <button
            onClick={() => setShowQuickAdd(true)}
            className="btn btn-secondary flex-1"
          >
            <Plus className="w-5 h-5" />
            Quick Add
          </button>
        </div>
      </header>

      {/* Error message */}
      {scanError && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {scanError}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {/* Loading state */}
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        )}

        {/* Search results */}
        {!isSearching && results.length > 0 && (
          <div className="p-4">
            <h2 className="text-sm text-slate-500 mb-2">Search Results</h2>
            <div className="space-y-1">
              {results.map(food => (
                <FoodRow
                  key={food.id}
                  food={food}
                  onClick={() => handleSelectRecent(food)}
                />
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!isSearching && query && results.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <p>No results found for "{query}"</p>
            <button
              onClick={() => setShowQuickAdd(true)}
              className="mt-4 text-primary-400 hover:text-primary-300"
            >
              Quick add calories instead
            </button>
          </div>
        )}

        {/* Recent/Frequent foods (when not searching) */}
        {!query && recentFoods.length > 0 && (
          <div className="p-4">
            <h2 className="text-sm text-slate-500 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent
            </h2>
            <div className="space-y-1">
              {recentFoods.slice(0, 15).map(saved => (
                <FoodRow
                  key={saved.id}
                  food={saved.food}
                  isFavorite={saved.isFavorite}
                  onClick={() => handleSelectRecent(saved.food)}
                  onToggleFavorite={() => toggleFavorite(saved.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!query && recentFoods.length === 0 && !isSearching && (
          <div className="p-8 text-center text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Search for a food or scan a barcode</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FoodRow({
  food,
  isFavorite,
  onClick,
  onToggleFavorite
}: {
  food: FoodItem
  isFavorite?: boolean
  onClick: () => void
  onToggleFavorite?: () => void
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-slate-800 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {food.brand ? <span className="text-slate-400">{food.brand} </span> : null}
          {food.name}
        </div>
        <div className="text-sm text-slate-500">
          {food.servingSize} {food.servingUnit} · {food.nutrition.calories} cal
        </div>
      </div>
      {onToggleFavorite && (
        <button
          onClick={e => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className={`p-2 ${isFavorite ? 'text-yellow-400' : 'text-slate-600'}`}
        >
          <Star className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      )}
    </div>
  )
}

function NutritionRow({
  label,
  value,
  unit,
  highlight
}: {
  label: string
  value: number
  unit: string
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className={highlight ? 'font-medium' : 'text-slate-400'}>{label}</span>
      <span className={highlight ? 'font-semibold text-primary-400' : ''}>
        {value} {unit}
      </span>
    </div>
  )
}
