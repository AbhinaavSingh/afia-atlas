import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import './App.css'

const HomePage = lazy(() =>
  import('./features/experience/HomePage').then((module) => ({
    default: module.HomePage,
  })),
)
const ContributePage = lazy(() =>
  import('./features/contribute/ContributePage').then((module) => ({
    default: module.ContributePage,
  })),
)
const AdminPage = lazy(() =>
  import('./features/admin/AdminPage').then((module) => ({
    default: module.AdminPage,
  })),
)

function App() {
  return (
    <Suspense
      fallback={
        <main className="center-state loading-state">
          <div className="loader-orbit" />
          <p>Gathering the stars…</p>
        </main>
      }
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/contribute" element={<ContributePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Suspense>
  )
}

export default App
