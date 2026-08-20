import { useQuery } from '@tanstack/react-query'
import { activities, coach } from '../api'
import { Activity, TrendingUp, Calendar, Zap, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, subDays, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { useState } from 'react'

export default function Dashboard() {
  const [syncing, setSyncing] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', 'week'],
    queryFn: () => activities.getStats('week').then(res => res.data)
  })

  const { data: weekActivities, isLoading: weekActivitiesLoading } = useQuery({
    queryKey: ['activities', 'week', weekOffset],
    queryFn: () => {
      const currentWeekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
      const currentWeekEnd = endOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
      
      return activities.getAll({ limit: 100 }).then(res => {
        return res.data.filter(a => {
          const activityDate = new Date(a.date)
          return activityDate >= currentWeekStart && activityDate <= currentWeekEnd
        })
      })
    }
  })

  const { data: recentActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities', 'recent'],
    queryFn: () => activities.getAll({ limit: 10 }).then(res => res.data)
  })

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: () => coach.getInsights().then(res => res.data)
  })

  const currentWeekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const currentWeekEnd = endOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 })
  const isCurrentWeek = weekOffset === 0

  const handleSync = async () => {
    setSyncing(true)
    try {
      await activities.sync()
      window.location.reload()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(currentWeekEnd, 6 - i)
    const dayActivities = weekActivities?.filter(a => {
      const activityDate = new Date(a.date)
      return activityDate.toDateString() === date.toDateString()
    }) || []
    return {
      key: i,
      day: format(date, 'EEE'),
      distance: dayActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
    }
  })

  if (statsLoading || activitiesLoading || weekActivitiesLoading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-600 border-t-transparent"></div>
    </div>
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-primary flex items-center space-x-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>Sync Strava</span>
        </button>
      </div>

      {/* Stats — hero card + 3 smaller */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 card bg-teal-600 dark:bg-teal-700 !border-teal-600 dark:!border-teal-700">
          <p className="text-sm text-teal-100 font-medium">Weekly Distance</p>
          <p className="text-5xl font-bold text-white mt-2 tracking-tight">
            {stats?.totalDistance?.toFixed(1) || 0}
            <span className="text-xl text-teal-200 ml-1">km</span>
          </p>
          <p className="text-xs text-teal-200 mt-2">Last 7 days &middot; {stats?.totalRuns || 0} runs</p>
        </div>

        <div className="card">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Avg Pace</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {stats?.averagePace ? `${Math.floor(stats.averagePace)}:${String(Math.round((stats.averagePace % 1) * 60)).padStart(2, '0')}` : '--'}
            <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>/km</span>
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Time</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {stats?.totalTime?.toFixed(1) || 0}
            <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>hrs</span>
          </p>
        </div>
      </div>

      {/* Charts + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Distance Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Weekly Distance</h3>
            <div className="flex items-center space-x-2">
              <button onClick={() => setWeekOffset(weekOffset + 1)} className="btn-secondary p-1.5">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium min-w-[130px] text-center" style={{ color: 'var(--text-secondary)' }}>
                {format(currentWeekStart, 'MMM d')} – {format(currentWeekEnd, 'MMM d')}
              </span>
              <button
                onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                disabled={isCurrentWeek}
                className="btn-secondary p-1.5 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--text-muted)" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--chart-tooltip-bg)', border: `1px solid var(--chart-tooltip-border)`, borderRadius: '8px', color: 'var(--text-primary)' }}
                formatter={(value) => [`${value.toFixed(1)} km`, 'Distance']}
              />
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
              <Bar dataKey="distance" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AI Insights — callout style */}
        <div className="card flex flex-col">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Coach Insights</h3>
          {insightsLoading ? (
            <div className="flex-1 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent"></div>
            </div>
          ) : (
            insights?.insights ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line overflow-y-auto max-h-[250px]"
                  style={{ borderLeft: '3px solid #0d9488', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                  {insights.insights}
                </div>
                <button className="btn-primary w-full mt-4 text-sm" onClick={() => window.location.href = '/coach'}>
                  Chat with Coach
                </button>
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Recent Activities — compact rows */}
      <div className="card">
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Activities</h3>
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {recentActivities?.slice(0, 5).map((activity) => (
            <div key={activity.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center space-x-3">
                <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{activity.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {format(new Date(activity.date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {((activity.distance || 0) / 1000).toFixed(2)} km
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {activity.pace ? `${Math.floor(activity.pace)}:${String(Math.round((activity.pace % 1) * 60)).padStart(2, '0')} /km` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
