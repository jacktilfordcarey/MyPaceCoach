import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auth } from './api'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Activities from './pages/Activities'
import Coach from './pages/Coach'
import Calendar from './pages/Calendar'
import Profile from './pages/Profile'
import RacePBs from './pages/RacePBs'

function App() {
  const { data: authStatus, isLoading } = useQuery({
    queryKey: ['authStatus'],
    queryFn: () => auth.getStatus().then(res => res.data),
    retry: false
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-600 border-t-transparent"></div>
      </div>
    )
  }

  const isAuthenticated = authStatus?.authenticated

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <Layout user={authStatus.user}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/goals" element={<Navigate to="/calendar" replace />} />
        <Route path="/race-pbs" element={<RacePBs />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
