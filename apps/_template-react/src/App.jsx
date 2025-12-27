import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="container">
      <h1>React App</h1>
      <p>Your app description here.</p>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </main>
  )
}

export default App
