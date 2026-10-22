import AnalysisSnapshot from '../models/AnalysisSnapshot.js';
import Activity from '../models/Activity.js';
import { computeWeeklyAnalysis } from './analysis.js';

function toNumber(value, fallback = 0) {
  const numericValue = Number(value ?? fallback);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function getWeekStart(date) {
  const current = new Date(date);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + mondayOffset);
  current.setHours(0, 0, 0, 0);
  return current;
}

function formatDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function buildWeeklySnapshotsFromActivities(activities = [], userId = null) {
  const weekBuckets = new Map();

  activities.forEach((activity) => {
    const runningDate = new Date(activity.date);
    if (Number.isNaN(runningDate.getTime())) return;

    const weekStart = formatDateKey(getWeekStart(runningDate));
    if (!weekBuckets.has(weekStart)) {
      weekBuckets.set(weekStart, []);
    }

    weekBuckets.get(weekStart).push(activity);
  });

  return [...weekBuckets.entries()]
    .map(([weekStart, weekRuns]) => {
      const summary = computeWeeklyAnalysis(weekRuns);
      const payload = {
        weekStart,
        totalDistanceKm: summary.totalDistanceKm,
        sessionCount: summary.sessionCount,
        load: summary.load,
        acwr: Number(Math.min(2, Math.max(0.4, 0.8 + (summary.totalDistanceKm / 100) * 0.2)).toFixed(2)),
        intensity: {
          easy: summary.intensityMinutes.easy,
          threshold: summary.intensityMinutes.threshold,
          aboveThreshold: summary.intensityMinutes.aboveThreshold
        },
        volumeDeltaPercent: 0,
        qualityScore: Number(Math.min(100, Math.max(0, 66 + summary.sessionCount * 4 + (summary.polarisationRatio || 0) * 8)).toFixed(1)),
        athlete: {
          focus: [],
          weeklyVolumeKm: summary.totalDistanceKm,
          trainingBlock: 'insufficient_data'
        },
        goals: [],
        summary: `${summary.totalDistanceKm.toFixed(1)} km over ${summary.sessionCount} sessions`
      };

      return {
        userId,
        type: 'weekly',
        weekStart,
        totalDistanceKm: payload.totalDistanceKm,
        sessionCount: payload.sessionCount,
        load: payload.load,
        acwr: payload.acwr,
        intensityEasy: payload.intensity.easy,
        intensityThreshold: payload.intensity.threshold,
        intensityAboveThreshold: payload.intensity.aboveThreshold,
        volumeDeltaPercent: payload.volumeDeltaPercent,
        qualityScore: payload.qualityScore,
        summary: payload.summary,
        payload
      };
    })
    .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart))
    .slice(0, 12);
}

export function buildAnalysisSnapshot({ weeks = [], athlete = {}, goals = [] } = {}) {
  const sortedWeeks = [...weeks].sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
  const latest = sortedWeeks[0] || {
    weekStart: new Date().toISOString().slice(0, 10),
    totalDistanceKm: 0,
    sessionCount: 0,
    acwr: 0,
    load: 0,
    intensity: { easy: 0, threshold: 0, aboveThreshold: 0 }
  };
  const previous = sortedWeeks[1] || latest;

  const previousVolume = toNumber(previous.totalDistanceKm, toNumber(latest.totalDistanceKm, 0));
  const currentVolume = toNumber(latest.totalDistanceKm, 0);
  const volumeDeltaPercent = previousVolume > 0
    ? ((currentVolume - previousVolume) / previousVolume) * 100
    : 0;

  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      100 - Math.abs(volumeDeltaPercent) * 1.5 + (toNumber(latest.acwr, 0) * 25) + (toNumber(latest.sessionCount, 0) * 1.5)
    )
  );

  const payload = {
    weekStart: latest.weekStart,
    totalDistanceKm: currentVolume,
    sessionCount: toNumber(latest.sessionCount, 0),
    load: toNumber(latest.load, 0),
    acwr: toNumber(latest.acwr, 0),
    intensity: {
      easy: toNumber(latest.intensity?.easy, 0),
      threshold: toNumber(latest.intensity?.threshold, 0),
      aboveThreshold: toNumber(latest.intensity?.aboveThreshold, 0)
    },
    volumeDeltaPercent,
    qualityScore,
    athlete: {
      focus: athlete?.focus || [],
      weeklyVolumeKm: toNumber(athlete?.weeklyVolumeKm, 0),
      trainingBlock: athlete?.trainingBlock || 'insufficient_data'
    },
    goals: (goals || []).map((goal) => ({
      title: goal.title || 'goal',
      type: goal.type || 'race',
      targetTime: goal.targetTime || null,
      targetDistance: goal.targetDistance || null
    })),
    summary: latest.summary || 'insufficient_data'
  };

  return payload;
}

export async function persistWeeklySnapshot(userId, weeks = [], context = {}) {
  const snapshot = buildAnalysisSnapshot({ weeks, athlete: context.athlete || {}, goals: context.goals || [] });

  const record = await AnalysisSnapshot.findOne({
    where: {
      userId,
      type: 'weekly',
      weekStart: snapshot.weekStart
    }
  });

  if (record) {
    await record.update({
      totalDistanceKm: snapshot.totalDistanceKm,
      sessionCount: snapshot.sessionCount,
      load: snapshot.load,
      acwr: snapshot.acwr,
      intensityEasy: snapshot.intensity.easy,
      intensityThreshold: snapshot.intensity.threshold,
      intensityAboveThreshold: snapshot.intensity.aboveThreshold,
      volumeDeltaPercent: snapshot.volumeDeltaPercent,
      qualityScore: snapshot.qualityScore,
      summary: snapshot.summary,
      payload: snapshot
    });
    return record.toJSON();
  }

  const created = await AnalysisSnapshot.create({
    userId,
    type: 'weekly',
    weekStart: snapshot.weekStart,
    totalDistanceKm: snapshot.totalDistanceKm,
    sessionCount: snapshot.sessionCount,
    load: snapshot.load,
    acwr: snapshot.acwr,
    intensityEasy: snapshot.intensity.easy,
    intensityThreshold: snapshot.intensity.threshold,
    intensityAboveThreshold: snapshot.intensity.aboveThreshold,
    volumeDeltaPercent: snapshot.volumeDeltaPercent,
    qualityScore: snapshot.qualityScore,
    summary: snapshot.summary,
    payload: snapshot
  });

  return created.toJSON();
}

export async function getRecentAnalysisSnapshots(userId, limit = 12) {
  const rows = await AnalysisSnapshot.findAll({
    where: { userId },
    order: [['weekStart', 'DESC']],
    limit
  });

  if (rows.length > 0) {
    return rows.map((row) => row.toJSON());
  }

  const activities = await Activity.findAll({
    where: { userId },
    order: [['date', 'ASC']]
  });

  if (!activities.length) {
    return [];
  }

  const generated = buildWeeklySnapshotsFromActivities(activities, userId).slice(0, limit);
  const created = await Promise.all(
    generated.map(async (snapshot) => {
      const [record] = await AnalysisSnapshot.findOrCreate({
        where: {
          userId,
          type: 'weekly',
          weekStart: snapshot.weekStart
        },
        defaults: {
          ...snapshot,
          userId,
          payload: snapshot.payload
        }
      });

      return record.toJSON();
    })
  );

  return created.sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
}
