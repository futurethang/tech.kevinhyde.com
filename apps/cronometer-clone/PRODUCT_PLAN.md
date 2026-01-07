# Cronometer Clone: Product & Technical Plan

## Executive Summary

A frictionless calorie and nutrition tracking PWA that prioritizes speed of entry over feature completeness. The core insight: **tracking fails when entry is cumbersome**. Every design decision should minimize friction.

---

## 1. Core Problem Statement

**Pain Point:** Existing calorie trackers (including Cronometer) have too much friction:
- Too many taps to log a simple food
- Overwhelming databases requiring precise searches
- Complex UIs with features most users never need
- $50/year for features you don't use

**Our Solution:** A stripped-down tracker that makes logging a meal faster than deciding not to log it.

---

## 2. MVP Feature Set (V0)

### Must Have (P0)
| Feature | Why Essential |
|---------|---------------|
| Food search with nutrition data | Core functionality |
| Barcode scanning | Fastest entry method for packaged foods |
| Quick-add calories | Fallback when search fails |
| Daily food diary | Track what you ate |
| Macro display (calories, protein, carbs, fat) | Primary metrics |
| Basic profile (age, height, weight, sex) | Needed for calculations |
| Goal setting (target weight, target date) | Motivation & deficit calculation |
| TDEE/calorie budget calculation | Shows daily target |
| Weight logging | Track progress |

### Should Have (P1 - Post V0)
| Feature | Notes |
|---------|-------|
| Recent/frequent foods | Reduces repeat entry friction |
| Favorites | Power user efficiency |
| Custom foods | For homemade meals |
| Micronutrients view | Fiber, vitamins, minerals |
| Simple progress chart | Weight over time |
| Meal copying (yesterday → today) | Common pattern |

### Could Have (P2 - Future)
| Feature | Notes |
|---------|-------|
| Recipe builder | Calculate nutrition for homemade recipes |
| Meal templates | "My usual breakfast" |
| Apple Health sync | Export weight/calories |
| Streaks/gamification | Habit reinforcement |
| Export data (CSV/JSON) | Data ownership |

### Won't Have (Out of Scope)
- Social features
- Exercise tracking (use a dedicated app)
- Meal planning
- Shopping lists
- Premium tiers

---

## 3. Technical Architecture

### Platform Decision: PWA (Progressive Web App)

**Why PWA over Native:**
- Single codebase (web skills)
- Works on iOS + Android + Desktop
- No app store approval delays
- Installable, works offline
- Camera access for barcode scanning
- Push notifications (if needed later)

**Stack:**
```
Frontend: React + TypeScript + Vite
Styling:  Tailwind CSS (rapid UI iteration)
State:    Zustand (simple, performant)
Storage:  IndexedDB (via Dexie.js) for offline-first
PWA:      Vite PWA plugin
Scanning: html5-qrcode or QuaggaJS (evaluate both)
```

### Data Architecture

**Offline-First Design:**
- All data stored locally in IndexedDB
- App works without internet (except food search/barcode lookup)
- Optional: Cloud sync later (Supabase free tier)

**Why Offline-First:**
- Instant response times
- Works anywhere (gym, grocery store with poor signal)
- No backend costs for V0
- User owns their data

---

## 4. Nutrition API Strategy

### Primary: Open Food Facts API (FREE)
- 2.8M+ products globally
- Native barcode lookup
- No API key required (but be a good citizen)
- Example: `https://world.openfoodfacts.org/api/v2/product/{barcode}`

### Secondary: USDA FoodData Central (FREE)
- 300K+ US foods
- Government-verified accuracy
- Better for generic foods (not barcoded)
- No API key required

### Fallback: Quick-Add
- User manually enters calories + macros
- Essential for restaurants, homemade food, missing items

### API Usage Flow
```
1. User scans barcode
   → Query Open Food Facts by barcode
   → Found? Display & confirm
   → Not found? Suggest text search

2. User types food name
   → Query USDA FoodData Central
   → Show top matches with serving sizes
   → User selects & adjusts quantity

3. Nothing found
   → Offer quick-add (just calories)
   → Offer custom food entry
```

---

## 5. Data Model

### Core Entities

```typescript
// User profile & goals
interface UserProfile {
  id: string
  name: string
  birthDate: string        // for age calculation
  sex: 'male' | 'female'
  heightCm: number
  activityLevel: ActivityLevel
  goalType: 'lose' | 'maintain' | 'gain'
  targetWeightKg: number
  targetDate: string
  createdAt: string
}

type ActivityLevel =
  | 'sedentary'      // BMR × 1.2
  | 'light'          // BMR × 1.375
  | 'moderate'       // BMR × 1.55
  | 'active'         // BMR × 1.725
  | 'very_active'    // BMR × 1.9

// Weight log entries
interface WeightEntry {
  id: string
  date: string           // YYYY-MM-DD
  weightKg: number
  note?: string
  createdAt: string
}

// Food items (from API or custom)
interface FoodItem {
  id: string
  source: 'openfoodfacts' | 'usda' | 'custom'
  sourceId?: string      // barcode or USDA ID
  name: string
  brand?: string
  servingSize: number
  servingUnit: string
  calories: number       // per serving
  protein: number        // grams
  carbs: number          // grams
  fat: number            // grams
  fiber?: number
  sugar?: number
  sodium?: number
  // ... other micros as needed
}

// Food diary entry
interface DiaryEntry {
  id: string
  date: string           // YYYY-MM-DD
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  foodId: string
  foodSnapshot: FoodItem // denormalized for offline
  servings: number       // multiplier
  createdAt: string
}

// Cached/favorite foods for quick access
interface SavedFood {
  id: string
  foodId: string
  food: FoodItem
  usageCount: number
  lastUsed: string
  isFavorite: boolean
}
```

### Calculated Values (Not Stored)

```typescript
// Derived at runtime
interface DailyStats {
  date: string
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  calorieTarget: number
  remaining: number
  percentComplete: number
}

interface UserMetrics {
  currentWeightKg: number  // most recent weight entry
  bmi: number
  bmr: number              // Mifflin-St Jeor
  tdee: number             // BMR × activity multiplier
  dailyCalorieTarget: number
  weeklyDeficit: number
  projectedWeeksToGoal: number
}
```

---

## 6. Calorie & Goal Calculations

### BMR (Mifflin-St Jeor Equation)
```
Male:   BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
Female: BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161
```

### TDEE (Total Daily Energy Expenditure)
```
TDEE = BMR × Activity Multiplier

Multipliers:
- Sedentary (desk job, little exercise): 1.2
- Light (1-3 days/week exercise): 1.375
- Moderate (3-5 days/week): 1.55
- Active (6-7 days/week): 1.725
- Very Active (physical job + exercise): 1.9
```

### Calorie Target Calculation
```
Goal: Lose X kg by target_date

1. Calculate weight to lose: current_weight - target_weight
2. Convert to calories: kg_to_lose × 7700 (kcal per kg of fat)
3. Calculate days available: target_date - today
4. Daily deficit needed: total_calories ÷ days
5. Daily target: TDEE - daily_deficit

Constraints:
- Minimum 1200 kcal/day (women) or 1500 kcal/day (men)
- Maximum deficit: 1000 kcal/day (2 lbs/week)
- Warn if goal requires unhealthy deficit
```

---

## 7. UX Strategy: Frictionless Entry

### Design Principles

1. **One-Tap Repeat**: Recently eaten foods always one tap away
2. **Scan First**: Camera icon prominent, scanning instant
3. **Smart Defaults**: Pre-select common serving sizes
4. **Forgiving Search**: Typo-tolerant, partial matches
5. **Quick Escape**: Always allow "just log calories" fallback
6. **Minimal Taps**: Every screen asks "can we remove a step?"

### Key Screens (V0)

```
┌─────────────────────────────┐
│  Today's Diary              │  ← Home screen
│  ────────────────────────   │
│  Remaining: 850 cal         │  ← Big, visible target
│  ████████████░░░ 65%        │
│                             │
│  [🔍 Search] [📷 Scan]     │  ← Primary actions
│                             │
│  ─ Breakfast ──────── 420   │
│    Coffee w/ cream    45    │
│    Eggs (2)          156    │
│    Toast + butter    219    │
│                             │
│  ─ Lunch ──────────── 0     │
│    + Add food               │
│                             │
│  ─ Dinner ─────────── 0     │
│    + Add food               │
│                             │
│  ─ Snacks ─────────── 0     │
│    + Add food               │
│                             │
└─────────────────────────────┘
```

### Food Entry Flow (Optimized)

```
Happy Path (Barcode):
1. Tap scan → Camera opens instantly
2. Point at barcode → Auto-detects
3. Food appears → Confirm serving size
4. Tap "Add" → Done (3 taps total)

Happy Path (Recent):
1. Tap "Add food" → Recent list shows first
2. Tap food → Confirm serving
3. Done (2 taps)

Fallback (Search):
1. Tap search → Keyboard opens
2. Type partial name → Results stream in
3. Tap match → Confirm serving
4. Done (typing + 2 taps)

Emergency (Quick-add):
1. Tap "+" → Quick-add option visible
2. Enter calories only
3. Done (minimal friction)
```

---

## 8. V0 Prototype Scope

### What V0 Delivers
- [ ] Installable PWA with offline diary
- [ ] Barcode scanning (Open Food Facts)
- [ ] Text search (USDA + Open Food Facts)
- [ ] Quick-add calories
- [ ] Daily diary with meal sections
- [ ] Macro tracking (cal, protein, carbs, fat)
- [ ] Profile setup (basic metrics)
- [ ] Goal setting (target weight, date)
- [ ] TDEE & calorie budget calculation
- [ ] Weight logging (manual entry)
- [ ] Recent foods list

### What V0 Doesn't Have
- Cloud sync (data is local only)
- Charts/visualizations
- Custom foods/recipes
- Micronutrients beyond basics
- Apple Health integration
- Multi-device sync

### Success Criteria
V0 is successful if:
1. You can log 3 meals in under 2 minutes total
2. Barcode scanning works reliably (>90% of packaged foods)
3. You actually use it for a week without reverting to Cronometer
4. Core calculations match expected values

---

## 9. Technical Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Barcode scanning unreliable on some devices | Medium | High | Test multiple libraries; fallback to manual entry |
| Open Food Facts missing products | Medium | Medium | Chain to USDA; allow custom entry |
| IndexedDB storage limits | Low | High | Compress old entries; export feature |
| PWA camera access issues | Low | High | Clear permission prompts; desktop fallback |
| Nutrition data inaccuracies | Medium | Medium | Allow user edits; multiple sources |

---

## 10. Open Questions

### Product Questions
1. **Macro ratios**: Should we show/let users set protein/carb/fat targets, or just focus on calories?
2. **Meal times**: Are 4 fixed meals (breakfast/lunch/dinner/snacks) sufficient, or need custom meals?
3. **Serving sizes**: How to handle "1 cup" vs "100g" vs "1 piece" elegantly?
4. **Negative feedback**: What happens when you exceed your calorie budget? Shame-free design?

### Technical Questions
1. **Which barcode library**: html5-qrcode vs QuaggaJS vs native Barcode Detection API?
2. **State management**: Is Zustand sufficient or need something more robust?
3. **Future sync**: Design data model now for eventual cloud sync, or iterate later?

---

## 11. Development Phases

### Phase 1: Foundation (V0 Core)
1. Set up React + Vite + PWA scaffold
2. Implement IndexedDB data layer
3. Build profile/onboarding flow
4. Implement TDEE calculations
5. Create diary UI (view only)

### Phase 2: Food Entry
1. Integrate Open Food Facts API
2. Integrate USDA FoodData Central
3. Build search UI with streaming results
4. Implement barcode scanning
5. Add food to diary flow

### Phase 3: Polish
1. Recent/frequent foods
2. Quick-add calories
3. Weight logging
4. Daily stats & remaining calories
5. PWA install prompt & offline support

### Phase 4: Validation
1. Use it yourself for 1 week
2. Note friction points
3. Iterate on UX
4. Bug fixes

---

## 12. API Reference

### Open Food Facts
```bash
# Get product by barcode
GET https://world.openfoodfacts.org/api/v2/product/{barcode}

# Search products
GET https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&json=1
```

### USDA FoodData Central
```bash
# Search foods
GET https://api.nal.usda.gov/fdc/v1/foods/search?query={query}&api_key=DEMO_KEY

# Get food by ID
GET https://api.nal.usda.gov/fdc/v1/food/{fdcId}?api_key=DEMO_KEY
```

---

## Sources & References

- [Open Food Facts API Documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [USDA FoodData Central API Guide](https://fdc.nal.usda.gov/api-guide/)
- [Mifflin-St Jeor Calculator](https://www.inchcalculator.com/mifflin-st-jeor-calculator/)
- [TDEE Calculator & Formulas](https://www.calculator.net/tdee-calculator.html)
- [QuaggaJS Barcode Scanner](https://serratus.github.io/quaggaJS/)
- [html5-qrcode Tutorial](https://scanbot.io/techblog/html5-barcode-scanner-tutorial/)
- [Building PWA Barcode Scanners](https://www.dynamsoft.com/codepool/build-simple-pwa-barcode-reader.html)

---

## Next Steps

Once you review this plan:
1. Confirm feature prioritization
2. Answer open questions (especially macro targets and meal structure)
3. I'll create the app scaffold and begin Phase 1
