import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifySession,
  computeIntervalQuality,
  computeWeeklyAnalysis,
  detectBuildDeloadCycle,
  compareBlocks,
  computeRaceSpecificIndicators
} from '../src/services/analysis.js';
import { buildAnalysisSnapshot, buildWeeklySnapshotsFromActivities } from '../src/services/analysisStore.js';
import { buildRecentTrainingProfile } from '../src/services/aiCoach.js';

const makeRun = ({
  id,
  date,
  distanceKm,
  movingTimeMin,
  averageHeartrate,
  maxHeartrate,
  paceMinPerKm,
  splits = [],
  type = 'Run',
  isRace = false
}) => ({
  id,
  name: `Run ${id}`,
  date: new Date(date),
  distance: distanceKm * 1000,
  movingTime: movingTimeMin * 60,
  averageHeartrate,
  maxHeartrate,
  pace: paceMinPerKm,
  averagePace: paceMinPerKm,
  type,
  isRace,
  splits
});

test('classifySession detects interval and easy sessions from pace variance and HR', () => {
  const intervalRun = makeRun({
    id: 1,
    date: '2026-01-04T08:00:00Z',
    distanceKm: 8,
    movingTimeMin: 37,
    averageHeartrate: 168,
    maxHeartrate: 182,
    paceMinPerKm: 4.6,
    splits: [
      { distance: 400, average_speed: 5.5 },
      { distance: 400, average_speed: 5.45 },
      { distance: 400, average_speed: 5.42 },
      { distance: 400, average_speed: 5.38 }
    ]
  });

  const easyRun = makeRun({
    id: 2,
    date: '2026-01-06T08:00:00Z',
    distanceKm: 11,
    movingTimeMin: 56,
    averageHeartrate: 146,
    maxHeartrate: 160,
    paceMinPerKm: 5.1,
    type: 'Run'
  });

  assert.equal(classifySession(intervalRun), 'interval');
  assert.equal(classifySession(easyRun), 'easy');
});

test('computeIntervalQuality captures rep-by-rep pace, fade and consistency', () => {
  const intervalRun = makeRun({
    id: 3,
    date: '2026-01-09T08:00:00Z',
    distanceKm: 4,
    movingTimeMin: 18,
    averageHeartrate: 170,
    maxHeartrate: 184,
    paceMinPerKm: 4.5,
    splits: [
      { distance: 400, elapsed_time: 52 },
      { distance: 400, elapsed_time: 54 },
      { distance: 400, elapsed_time: 56 },
      { distance: 400, elapsed_time: 58 }
    ]
  });

  const quality = computeIntervalQuality(intervalRun);

  assert.equal(quality.repCount, 4);
  assert.ok(quality.fadePercent > 0);
  assert.ok(quality.consistencyCv >= 0);
  assert.ok(quality.recoverySeconds >= 0);
});

test('computeWeeklyAnalysis returns intensity, load and A:C ratio with sensible values', () => {
  const week = [
    makeRun({ id: 10, date: '2026-01-04T08:00:00Z', distanceKm: 8, movingTimeMin: 40, averageHeartrate: 148, maxHeartrate: 164, paceMinPerKm: 5.0 }),
    makeRun({ id: 11, date: '2026-01-05T08:00:00Z', distanceKm: 12, movingTimeMin: 53, averageHeartrate: 160, maxHeartrate: 178, paceMinPerKm: 4.4 }),
    makeRun({ id: 12, date: '2026-01-07T08:00:00Z', distanceKm: 14, movingTimeMin: 61, averageHeartrate: 165, maxHeartrate: 180, paceMinPerKm: 4.35 }),
    makeRun({ id: 13, date: '2026-01-09T08:00:00Z', distanceKm: 17, movingTimeMin: 72, averageHeartrate: 150, maxHeartrate: 166, paceMinPerKm: 4.2 }),
    makeRun({ id: 14, date: '2026-01-11T08:00:00Z', distanceKm: 10, movingTimeMin: 46, averageHeartrate: 138, maxHeartrate: 155, paceMinPerKm: 4.6 })
  ];

  const summary = computeWeeklyAnalysis(week);

  assert.equal(summary.sessionCount, 5);
  assert.ok(summary.totalDistanceKm > 50);
  assert.ok(summary.load > 0);
  assert.ok(summary.acwr >= 0);
  assert.ok(summary.polarisationRatio > 0);
});

test('detectBuildDeloadCycle identifies a skipped deload or volume jump', () => {
  const weeks = [
    { weekStart: '2026-01-04', totalDistanceKm: 72, sessionCount: 5 },
    { weekStart: '2026-01-11', totalDistanceKm: 78, sessionCount: 5 },
    { weekStart: '2026-01-18', totalDistanceKm: 75, sessionCount: 4 },
    { weekStart: '2026-01-25', totalDistanceKm: 88, sessionCount: 5 },
    { weekStart: '2026-02-01', totalDistanceKm: 90, sessionCount: 5 }
  ];

  const cycle = detectBuildDeloadCycle(weeks);

  assert.equal(cycle.cyclePattern, '3:1');
  assert.ok(cycle.skippedDeload || cycle.volumeJump > 0.1);
});

test('compareBlocks compares current and prev blocks with meaningful deltas', () => {
  const current = [
    makeRun({ id: 20, date: '2026-02-01T08:00:00Z', distanceKm: 10, movingTimeMin: 45, averageHeartrate: 150, maxHeartrate: 170, paceMinPerKm: 4.5 }),
    makeRun({ id: 21, date: '2026-02-04T08:00:00Z', distanceKm: 12, movingTimeMin: 50, averageHeartrate: 160, maxHeartrate: 176, paceMinPerKm: 4.2 }),
    makeRun({ id: 22, date: '2026-02-07T08:00:00Z', distanceKm: 15, movingTimeMin: 62, averageHeartrate: 165, maxHeartrate: 180, paceMinPerKm: 4.1 })
  ];

  const previous = [
    makeRun({ id: 23, date: '2026-01-01T08:00:00Z', distanceKm: 9, movingTimeMin: 44, averageHeartrate: 148, maxHeartrate: 165, paceMinPerKm: 4.9 }),
    makeRun({ id: 24, date: '2026-01-05T08:00:00Z', distanceKm: 9, movingTimeMin: 42, averageHeartrate: 152, maxHeartrate: 170, paceMinPerKm: 4.7 }),
    makeRun({ id: 25, date: '2026-01-09T08:00:00Z', distanceKm: 11, movingTimeMin: 48, averageHeartrate: 158, maxHeartrate: 176, paceMinPerKm: 4.4 })
  ];

  const comparison = compareBlocks(current, previous);

  assert.ok('deltaVolumePercent' in comparison);
  assert.ok('deltaSessionCount' in comparison);
  assert.ok('summary' in comparison);
});

test('computeRaceSpecificIndicators reflects 800m and 1500m goal relevance', () => {
  const activities = [
    makeRun({ id: 30, date: '2026-03-01T08:00:00Z', distanceKm: 10, movingTimeMin: 39, averageHeartrate: 160, maxHeartrate: 176, paceMinPerKm: 3.9, isRace: false }),
    makeRun({ id: 31, date: '2026-03-03T08:00:00Z', distanceKm: 4, movingTimeMin: 18, averageHeartrate: 170, maxHeartrate: 182, paceMinPerKm: 4.5, type: 'Workout' }),
    makeRun({ id: 32, date: '2026-03-06T08:00:00Z', distanceKm: 1.5, movingTimeMin: 5.8, averageHeartrate: 174, maxHeartrate: 186, paceMinPerKm: 3.86, isRace: true })
  ];

  const indicators = computeRaceSpecificIndicators(activities, { target800m: 150, target1500m: 240 });

  assert.ok(indicators.volumeAtGoalPace >= 0);
  assert.ok(indicators.speedEnduranceSessions >= 0);
  assert.ok(indicators.topEndSessions >= 0);
});

test('buildAnalysisSnapshot creates a compact persisted weekly summary with derived metrics', () => {
  const weeks = [
    { weekStart: '2026-06-01', totalDistanceKm: 92, sessionCount: 5, acwr: 1.12, load: 146, intensity: { easy: 124, threshold: 36, aboveThreshold: 30 } },
    { weekStart: '2026-06-08', totalDistanceKm: 87, sessionCount: 5, acwr: 1.07, load: 138, intensity: { easy: 121, threshold: 33, aboveThreshold: 28 } },
    { weekStart: '2026-06-15', totalDistanceKm: 80, sessionCount: 4, acwr: 0.93, load: 118, intensity: { easy: 116, threshold: 29, aboveThreshold: 22 } }
  ];

  const snapshot = buildAnalysisSnapshot({ weeks });

  assert.equal(snapshot.weekStart, '2026-06-15');
  assert.ok(snapshot.totalDistanceKm > 0);
  assert.ok(snapshot.acwr >= 0);
  assert.ok(snapshot.intensity);
  assert.ok(snapshot.qualityScore >= 0);
});

test('buildRecentTrainingProfile weights recent pace and heart-rate data for race prediction', () => {
  const recentRuns = [
    makeRun({ id: 50, date: '2026-06-01T08:00:00Z', distanceKm: 8, movingTimeMin: 37, averageHeartrate: 160, maxHeartrate: 174, paceMinPerKm: 4.62 }),
    makeRun({ id: 51, date: '2026-06-04T08:00:00Z', distanceKm: 7, movingTimeMin: 31, averageHeartrate: 163, maxHeartrate: 176, paceMinPerKm: 4.43 }),
    makeRun({ id: 52, date: '2026-06-08T08:00:00Z', distanceKm: 10, movingTimeMin: 46, averageHeartrate: 158, maxHeartrate: 172, paceMinPerKm: 4.6 }),
    makeRun({ id: 53, date: '2026-06-11T08:00:00Z', distanceKm: 12, movingTimeMin: 55, averageHeartrate: 155, maxHeartrate: 168, paceMinPerKm: 4.58 }),
    makeRun({ id: 54, date: '2026-06-15T08:00:00Z', distanceKm: 14, movingTimeMin: 61, averageHeartrate: 152, maxHeartrate: 167, paceMinPerKm: 4.36 })
  ];

  const profile = buildRecentTrainingProfile(recentRuns);

  assert.ok(profile.recentRuns >= 3);
  assert.ok(profile.avgPace > 0);
  assert.ok(profile.avgHeartRate > 0);
  assert.ok(profile.recentPaceRange.min >= 0);
  assert.ok(profile.recentPaceRange.max >= profile.recentPaceRange.min);
  assert.ok(Array.isArray(profile.recentQualityPaces));
});

test('buildWeeklySnapshotsFromActivities derives weekly snapshots from raw activity history', () => {
  const activities = [
    makeRun({ id: 40, date: '2026-01-04T08:00:00Z', distanceKm: 8, movingTimeMin: 40, averageHeartrate: 148, maxHeartrate: 158, paceMinPerKm: 5.0 }),
    makeRun({ id: 41, date: '2026-01-06T08:00:00Z', distanceKm: 10, movingTimeMin: 47, averageHeartrate: 150, maxHeartrate: 160, paceMinPerKm: 4.7 }),
    makeRun({ id: 42, date: '2026-01-11T08:00:00Z', distanceKm: 12, movingTimeMin: 54, averageHeartrate: 154, maxHeartrate: 170, paceMinPerKm: 4.5 }),
    makeRun({ id: 43, date: '2026-01-13T08:00:00Z', distanceKm: 9, movingTimeMin: 45, averageHeartrate: 148, maxHeartrate: 162, paceMinPerKm: 5.0 })
  ];

  const snapshots = buildWeeklySnapshotsFromActivities(activities);

  assert.ok(Array.isArray(snapshots));
  assert.ok(snapshots.length >= 2);
  assert.ok(snapshots[0].totalDistanceKm >= 0);
  assert.ok(snapshots[0].sessionCount >= 1);
  assert.ok(snapshots[0].payload.summary.length > 0);
});
