import { useQuery } from '@tanstack/react-query'
import { coach } from '../api'
import { Activity, Gauge, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

function buildNextWeeksPlan(snapshots = []) {
  const sorted = [...snapshots]
    .filter((snapshot) => Number(snapshot?.totalDistanceKm || 0) > 0)
    .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart))

  const recentVolume = sorted.slice(0, 4).reduce((sum, week) => sum + Number(week.totalDistanceKm || 0), 0) / Math.max(sorted.slice(0, 4).length, 1)
  const baseline = Number.isFinite(recentVolume) && recentVolume > 0 ? recentVolume : 45
  const currentAcwr = Number(sorted[0]?.acwr || 0)
  const quality = Number(sorted[0]?.qualityScore || 0)

  const volumes = [
    baseline * (quality < 75 ? 0.94 : 1.02),
    baseline * (currentAcwr > 1.1 ? 0.98 : 1.12),
    baseline * (currentAcwr > 1.15 ? 1.0 : 1.2),
    baseline * 0.97
  ]

  const weeklyPattern = [
    { day: 'Mon', type: 'Easy', share: 0.12 },
    { day: 'Tue', type: 'Workout', share: 0.18 },
    { day: 'Wed', type: 'Recovery', share: 0.08 },
    { day: 'Thu', type: 'Tempo', share: 0.17 },
    { day: 'Fri', type: 'Easy', share: 0.08 },
    { day: 'Sat', type: 'Long', share: 0.27 },
    { day: 'Sun', type: 'Easy', share: 0.1 }
  ]

  return volumes.map((totalDistance, index) => {
    const runs = weeklyPattern.map((item, itemIndex) => {
      const distance = Number((totalDistance * item.share).toFixed(1))
      return {
        day: item.day,
        type: item.type,
        distance: itemIndex === weeklyPattern.length - 1 ? Number((totalDistance - weeklyPattern.slice(0, -1).reduce((sum, run) => sum + totalDistance * run.share, 0)).toFixed(1)) : distance,
        description: item.type === 'Workout'
          ? 'Track or hill reps with controlled effort and relaxed recovery.'
          : item.type === 'Tempo'
            ? 'Threshold effort with smooth rhythm and steady pacing.'
            : item.type === 'Long'
              ? 'Long aerobic run to build endurance and time on feet.'
              : item.type === 'Recovery'
                ? 'Short shakeout to stay fresh and keep legs moving.'
                : 'Easy aerobic mileage to support consistency and recovery.'
      }
    })

    return {
      weekNumber: index + 1,
      totalDistance: Number(totalDistance.toFixed(1)),
      runs
    }
  })
}

export default function Analysis() {
  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: ['analysisSnapshots'],
    queryFn: () => coach.getAnalysisSnapshots().then(res => res.data),
    staleTime: 5 * 60 * 1000
  })

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analysisOverview'],
    queryFn: () => coach.getAnalysis(90).then(res => res.data),
    staleTime: 5 * 60 * 1000
  })

  const chartData = [...snapshots]
    .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
    .map((snapshot) => ({
      name: format(new Date(snapshot.weekStart), 'MMM d'),
      distance: Number(snapshot.totalDistanceKm || 0),
      load: Number(snapshot.load || 0),
      acwr: Number(snapshot.acwr || 0),
      quality: Number(snapshot.qualityScore || 0)
    }))

  const latest = snapshots[0] ?? null
  const latestSummary = latest?.payload ?? latest ?? {}
  const hasData = snapshots.length > 0
  const nextWeeksPlan = buildNextWeeksPlan(snapshots)

  if (!snapshotsLoading && !overviewLoading && !hasData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center">
          <div className="flex justify-center mb-4">
            <TrendingUp className="w-10 h-10 text-teal-600 dark:text-teal-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No analysis yet</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Add a few runs and sync your Strava data to unlock weekly volume, ACWR, and training quality insights.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>Training Intelligence</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Analysis</h1>
        </div>
      </div>

      {snapshotsLoading || overviewLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-600 border-t-transparent"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Weekly volume</span>
                <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <p className="text-3xl font-bold mt-3" style={{ color: 'var(--text-primary)' }}>
                {Number(latest?.totalDistanceKm || 0).toFixed(1)}
                <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>km</span>
              </p>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Load</span>
                <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="text-3xl font-bold mt-3" style={{ color: 'var(--text-primary)' }}>
                {Number(latest?.load || 0).toFixed(0)}
              </p>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>ACWR</span>
                <Gauge className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-3xl font-bold mt-3" style={{ color: 'var(--text-primary)' }}>
                {Number(latest?.acwr || 0).toFixed(2)}
              </p>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Quality score</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-3xl font-bold mt-3" style={{ color: 'var(--text-primary)' }}>
                {Number(latest?.qualityScore || 0).toFixed(0)}
                <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>/100</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 card">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Volume trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(1)} km`, 'Distance']}
                      contentStyle={{ backgroundColor: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    />
                    <Line type="monotone" dataKey="distance" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Current signal</h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {latestSummary?.summary || latest?.summary || 'No weekly summary available yet.'}
                </p>
              </div>

              <div className="card">
                <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Quick notes</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <div className="flex items-center justify-between">
                    <span>Sessions</span>
                    <strong>{Number(latest?.sessionCount || 0)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Volume Δ</span>
                    <strong>{Number(latest?.volumeDeltaPercent || 0).toFixed(1)}%</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Training block</span>
                    <strong>{latestSummary?.athlete?.trainingBlock || 'insufficient_data'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Next 4 weeks</h3>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Based on recent training</span>
            </div>
            <div className="space-y-4">
              {nextWeeksPlan.map((week) => (
                <div key={week.weekNumber} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Week {week.weekNumber}</h4>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{week.totalDistance.toFixed(1)} km</span>
                  </div>
                  <div className="space-y-2">
                    {week.runs.map((run) => (
                      <div key={`${week.weekNumber}-${run.day}`} className="flex items-start gap-3 text-sm">
                        <span className="w-14 font-medium" style={{ color: 'var(--text-muted)' }}>{run.day}</span>
                        <div className="flex-1">
                          <span style={{ color: 'var(--text-primary)' }}>{run.type} · {run.distance.toFixed(1)} km</span>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{run.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent weekly snapshots</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="pb-3 text-left">Week</th>
                    <th className="pb-3 text-left">Distance</th>
                    <th className="pb-3 text-left">Load</th>
                    <th className="pb-3 text-left">ACWR</th>
                    <th className="pb-3 text-left">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshots].slice(0, 6).map((row) => (
                    <tr key={row.id || row.weekStart} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="py-3" style={{ color: 'var(--text-primary)' }}>{format(new Date(row.weekStart), 'MMM d')}</td>
                      <td className="py-3" style={{ color: 'var(--text-secondary)' }}>{Number(row.totalDistanceKm || 0).toFixed(1)} km</td>
                      <td className="py-3" style={{ color: 'var(--text-secondary)' }}>{Number(row.load || 0).toFixed(0)}</td>
                      <td className="py-3" style={{ color: 'var(--text-secondary)' }}>{Number(row.acwr || 0).toFixed(2)}</td>
                      <td className="py-3" style={{ color: 'var(--text-secondary)' }}>{Number(row.qualityScore || 0).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
