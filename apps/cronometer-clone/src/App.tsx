import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { Diary } from './pages/Diary'
import { Onboarding } from './pages/Onboarding'
import { AddFood } from './pages/AddFood'
import { Profile } from './pages/Profile'
import { Weight } from './pages/Weight'
import { Loader2 } from 'lucide-react'

export default function App() {
  const { initialize, isLoading, isOnboarding } = useStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (isOnboarding) {
    return <Onboarding />
  }

  return (
    <Routes>
      <Route path="/" element={<Diary />} />
      <Route path="/add/:meal" element={<AddFood />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/weight" element={<Weight />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
