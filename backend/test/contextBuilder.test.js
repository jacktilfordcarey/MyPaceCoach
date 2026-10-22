import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCoachContext } from '../src/services/contextBuilder.js';

test('buildCoachContext collapses derived metrics into compact structured JSON and excludes raw streams', () => {
  const ctx = buildCoachContext({
    athlete: {
      focus: ['800m', '1500m'],
      weeklyVolumeKm: 85,
      keySessions: ['Tue', 'Thu', 'Sat', 'Sun']
    },
    goals: [{ title: 'Sub-2:00 800m', type: 'race', raceDate: '2026-07-15T00:00:00Z' }],
    weeks: [
      { weekStart: '2026-06-01', totalDistanceKm: 92, sessionCount: 6, acwr: 1.18, intensity: { easy: 120, threshold: 35, aboveThreshold: 28 }, load: 146 },
      { weekStart: '2026-06-08', totalDistanceKm: 88, sessionCount: 5, acwr: 1.05, intensity: { easy: 118, threshold: 40, aboveThreshold: 25 }, load: 132 }
    ],
    keySessions: [
      { sessionType: 'interval', repCount: 6, fadePercent: 3.1, quality: 'consistent' },
      { sessionType: 'threshold', durationMinutes: 32 }
    ],
    upcomingRaces: [{ name: 'Track 1500m', date: '2026-07-15T00:00:00Z' }],
    analysis: { weeklyTrend: 'stable' }
  });

  assert.equal(typeof ctx, 'string');
  assert.match(ctx, /800m|1500m|Sub-2:00 800m/i);
  assert.doesNotMatch(ctx, /splits|raw streams|distance.*meter/i);
  assert.match(ctx, /repCount|fadePercent|acwr/i);
});
