import { Activity, LogOut, Edit3, AlertTriangle, UserPlus, ArrowLeft, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'

const emptySignUp = { username: '', email: '', password: '', confirmPassword: '' }
const emptyLogin = { email: '', password: '' }

export default function Login() {
  const [view, setView] = useState('options')
  const [signUpData, setSignUpData] = useState(emptySignUp)
  const [loginData, setLoginData] = useState(emptyLogin)
  const [authError, setAuthError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')

    if (errorParam) {
      const decoded = decodeURIComponent(errorParam)
      setAuthError(decoded)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleStravaLogin = () => {
    window.location.href = '/api/auth/strava'
  }

  const handleManualSignUp = async () => {
    if (!signUpData.username || !signUpData.email || !signUpData.password) {
      setStatusMessage('Please fill in your username, email, and password.')
      return
    }

    if (signUpData.password.length < 6) {
      setStatusMessage('Password must be at least 6 characters long.')
      return
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      setStatusMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    setStatusMessage('')

    try {
      const response = await fetch('/api/auth/manual/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signUpData.username,
          email: signUpData.email,
          password: signUpData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setStatusMessage(data?.error || 'Unable to create your account.')
        return
      }

      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Manual signup error:', error)
      setStatusMessage('Something went wrong creating your account.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleManualLogin = async () => {
    if (!loginData.email || !loginData.password) {
      setStatusMessage('Please enter your email and password.')
      return
    }

    setIsSubmitting(true)
    setStatusMessage('')

    try {
      const response = await fetch('/api/auth/manual/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      })

      const data = await response.json()

      if (!response.ok) {
        setStatusMessage(data?.error || 'Unable to sign you in.')
        return
      }

      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Manual login error:', error)
      setStatusMessage('Something went wrong signing you in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderOptions = () => (
    <div className="space-y-3">
      <button
        onClick={handleStravaLogin}
        className="w-full bg-[#fc4c02] hover:bg-[#e84402] text-white font-semibold py-4 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-2"
      >
        <span>Sign in with Strava</span>
        <LogOut className="w-5 h-5 rotate-180" />
      </button>

      <button
        onClick={() => setView('login')}
        className="w-full py-4 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-2 font-medium"
        style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
      >
        <LockKeyhole className="w-5 h-5" />
        <span>Log in with email</span>
      </button>

      <button
        onClick={() => setView('signup')}
        className="w-full py-4 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-2 font-medium"
        style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
      >
        <UserPlus className="w-5 h-5" />
        <span>Create manual account</span>
      </button>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
        By connecting, you agree to share your Strava data
      </p>
    </div>
  )

  const renderLoginForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Email</label>
        <input
          type="email"
          value={loginData.email}
          onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
          className="input py-3"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Password</label>
        <input
          type="password"
          value={loginData.password}
          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
          className="input py-3"
          placeholder="Enter your password"
        />
      </div>

      <button
        onClick={handleManualLogin}
        disabled={isSubmitting || !loginData.email || !loginData.password}
        className="w-full btn-primary font-semibold py-4 rounded-xl disabled:opacity-40"
      >
        {isSubmitting ? 'Signing in...' : 'Log in'}
      </button>

      <button
        onClick={() => setView('options')}
        className="w-full py-2 text-sm transition-colors flex items-center justify-center gap-2"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to options
      </button>
    </div>
  )

  const renderSignUpForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Username</label>
        <input
          type="text"
          value={signUpData.username}
          onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
          className="input py-3"
          placeholder="Choose a username"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Email</label>
        <input
          type="email"
          value={signUpData.email}
          onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
          className="input py-3"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Password</label>
        <input
          type="password"
          value={signUpData.password}
          onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
          className="input py-3"
          placeholder="Create a password"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Confirm password</label>
        <input
          type="password"
          value={signUpData.confirmPassword}
          onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
          className="input py-3"
          placeholder="Confirm your password"
        />
      </div>

      <button
        onClick={handleManualSignUp}
        disabled={isSubmitting || !signUpData.username || !signUpData.email || !signUpData.password || !signUpData.confirmPassword}
        className="w-full btn-primary font-semibold py-4 rounded-xl disabled:opacity-40"
      >
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>

      <button
        onClick={() => setView('options')}
        className="w-full py-2 text-sm transition-colors flex items-center justify-center gap-2"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to options
      </button>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-sm w-full">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
            My<span className="text-teal-600 dark:text-teal-400">Pace</span>
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)' }}>Run smarter.</p>
        </div>

        {authError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm" style={{ color: '#fbbf24' }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Strava is temporarily unavailable</div>
              <div className="mt-1">{authError}</div>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm" style={{ color: 'var(--text-primary)' }}>
            {statusMessage}
          </div>
        )}

        {view === 'options' && renderOptions()}
        {view === 'login' && renderLoginForm()}
        {view === 'signup' && renderSignUpForm()}
      </div>
    </div>
  )
}
