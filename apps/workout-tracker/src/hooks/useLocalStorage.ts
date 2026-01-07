import { useState, useCallback } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Get initial value from localStorage or use provided initial
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when state changes
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setStoredValue((prev) => {
          const valueToStore = value instanceof Function ? value(prev) : value;
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          return valueToStore;
        });
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  return [storedValue, setValue];
}

// Hook for managing exercise logs
export function useExerciseLogs() {
  return useLocalStorage<Record<string, unknown>[]>('workout-exercise-logs', []);
}

// Hook for managing session logs
export function useSessionLogs() {
  return useLocalStorage<Record<string, unknown>[]>('workout-session-logs', []);
}

// Hook for managing user preferences
export function usePreferences() {
  return useLocalStorage('workout-preferences', {
    weightUnit: 'lbs' as const,
    defaultRestSeconds: 60,
    defaultActiveSeconds: 45,
    soundEnabled: true,
    vibrationEnabled: true,
    keepScreenOn: true,
  });
}

// Hook for tracking last used weights per exercise
export function useExerciseWeights() {
  return useLocalStorage<Record<string, number>>('workout-exercise-weights', {});
}
