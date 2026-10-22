export function buildCoachContext({ athlete, goals = [], weeks = [], keySessions = [], upcomingRaces = [], analysis = {} }) {
  const compactGoals = goals.map((goal) => ({
    title: goal.title,
    type: goal.type,
    raceDate: goal.raceDate,
    targetTime: goal.targetTime,
    targetDistance: goal.targetDistance
  }));

  const compactWeeks = weeks.map((week) => ({
    weekStart: week.weekStart,
    totalDistanceKm: Number(week.totalDistanceKm ?? 0),
    sessionCount: Number(week.sessionCount ?? 0),
    acwr: Number(week.acwr ?? 0),
    load: Number(week.load ?? 0),
    intensity: {
      easy: Number(week.intensity?.easy ?? 0),
      threshold: Number(week.intensity?.threshold ?? 0),
      aboveThreshold: Number(week.intensity?.aboveThreshold ?? 0)
    }
  }));

  const compactKeySessions = keySessions.map((session) => ({
    sessionType: session.sessionType,
    repCount: Number(session.repCount ?? 0),
    fadePercent: Number(session.fadePercent ?? 0),
    quality: session.quality || 'insufficient_data',
    durationMinutes: Number(session.durationMinutes ?? 0),
    summary: session.summary || 'insufficient_data'
  }));

  const compactRaces = upcomingRaces.map((race) => ({
    name: race.name,
    date: race.date,
    distance: race.distance || null
  }));

  return JSON.stringify({
    athlete: {
      focus: athlete?.focus || [],
      weeklyVolumeKm: Number(athlete?.weeklyVolumeKm ?? 0),
      keySessions: athlete?.keySessions || [],
      trainingBlock: athlete?.trainingBlock || 'insufficient_data'
    },
    goals: compactGoals,
    weeks: compactWeeks,
    keySessions: compactKeySessions,
    upcomingRaces: compactRaces,
    analysis: {
      weeklyTrend: analysis.weeklyTrend || 'insufficient_data',
      buildDeload: analysis.buildDeload || 'insufficient_data',
      fatigueRisk: analysis.fatigueRisk || 'insufficient_data',
      raceReadiness: analysis.raceReadiness || 'insufficient_data'
    }
  }, null, 2);
}

export function buildSpecialistPrompt(context) {
  return `You are MyPace, a specialized 800m/1500m running coach. Base every recommendation on the athlete data below. Do not guess. If the data is missing or thin, say "insufficient data" exactly.

Coach rules:
- cite exact numbers from the compact JSON when making claims
- compare against the previous block or previous week before giving a change
- prefer clear training adjustments over generic motivational advice
- never describe raw streams, splits, or unprocessed Strava data; only use the derived metrics provided
- talk in terms of 800m / 1500m specific development: cadence, quality reps, threshold, long run support, and race-specific sharpening

Athlete context JSON:
${context}

Return a concise, practical coaching note with:
1. the key interpretation from the last 4-8 weeks
2. the most important specific risk or signal
3. one precise adjustment for the next session or week
4. a direct comparison to the previous block when data exists

Keep it brief, evidence-backed, and specific.`;
}
