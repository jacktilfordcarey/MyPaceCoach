import assert from 'node:assert/strict';
import { buildCoachContext, buildSpecialistPrompt } from '../src/services/contextBuilder.js';

const scenarios = [
  {
    name: 'skipped deload',
    context: {
      athlete: { focus: ['800m', '1500m'], weeklyVolumeKm: 90, keySessions: ['Tue', 'Thu', 'Sat'], trainingBlock: 'build' },
      goals: [{ title: 'Sub-2:00 800m', type: 'race' }],
      weeks: [
        { weekStart: '2026-06-01', totalDistanceKm: 92, sessionCount: 5, acwr: 1.12, load: 146, intensity: { easy: 124, threshold: 36, aboveThreshold: 30 } },
        { weekStart: '2026-06-08', totalDistanceKm: 88, sessionCount: 5, acwr: 1.08, load: 138, intensity: { easy: 121, threshold: 33, aboveThreshold: 27 } },
        { weekStart: '2026-06-15', totalDistanceKm: 84, sessionCount: 4, acwr: 0.94, load: 123, intensity: { easy: 118, threshold: 30, aboveThreshold: 24 } },
        { weekStart: '2026-06-22', totalDistanceKm: 96, sessionCount: 6, acwr: 1.2, load: 159, intensity: { easy: 126, threshold: 38, aboveThreshold: 35 } }
      ],
      keySessions: [{ sessionType: 'interval', repCount: 6, fadePercent: 4.2, quality: 'fading', summary: 'rep 6 was 4.2% slower than rep 1' }],
      upcomingRaces: [{ name: 'Track 800m', date: '2026-07-10T00:00:00Z' }],
      analysis: { weeklyTrend: 'rising', buildDeload: 'skipped_deload', fatigueRisk: 'elevated', raceReadiness: 'cautious' }
    }
  },
  {
    name: 'fading intervals',
    context: {
      athlete: { focus: ['800m', '1500m'], weeklyVolumeKm: 83, keySessions: ['Tue', 'Thu', 'Sat'], trainingBlock: 'specific' },
      goals: [{ title: 'Sub-4:00 1500m', type: 'race' }],
      weeks: [
        { weekStart: '2026-06-01', totalDistanceKm: 86, sessionCount: 5, acwr: 1.04, load: 130, intensity: { easy: 120, threshold: 39, aboveThreshold: 26 } },
        { weekStart: '2026-06-08', totalDistanceKm: 82, sessionCount: 5, acwr: 0.99, load: 126, intensity: { easy: 118, threshold: 35, aboveThreshold: 23 } }
      ],
      keySessions: [{ sessionType: 'interval', repCount: 6, fadePercent: 3.1, quality: 'consistent', summary: 'rep 6 was 3.1% slower than rep 1' }],
      upcomingRaces: [{ name: 'Track 1500m', date: '2026-07-15T00:00:00Z' }],
      analysis: { weeklyTrend: 'stable', buildDeload: 'insufficient_data', fatigueRisk: 'moderate', raceReadiness: 'good' }
    }
  },
  {
    name: 'load spike',
    context: {
      athlete: { focus: ['800m', '1500m'], weeklyVolumeKm: 96, keySessions: ['Tue', 'Thu', 'Sat'], trainingBlock: 'build' },
      goals: [{ title: 'Sub-2:00 800m', type: 'race' }],
      weeks: [
        { weekStart: '2026-06-01', totalDistanceKm: 70, sessionCount: 4, acwr: 0.92, load: 110, intensity: { easy: 104, threshold: 24, aboveThreshold: 18 } },
        { weekStart: '2026-06-08', totalDistanceKm: 88, sessionCount: 5, acwr: 1.08, load: 138, intensity: { easy: 118, threshold: 31, aboveThreshold: 23 } },
        { weekStart: '2026-06-15', totalDistanceKm: 102, sessionCount: 6, acwr: 1.25, load: 170, intensity: { easy: 127, threshold: 42, aboveThreshold: 38 } }
      ],
      keySessions: [{ sessionType: 'long', repCount: 0, fadePercent: 0, quality: 'insufficient_data', summary: 'long run volume jumped 15%' }],
      upcomingRaces: [{ name: 'Track 800m', date: '2026-07-20T00:00:00Z' }],
      analysis: { weeklyTrend: 'rising', buildDeload: 'skipped_deload', fatigueRisk: 'high', raceReadiness: 'cautious' }
    }
  }
];

for (const scenario of scenarios) {
  const context = buildCoachContext(scenario.context);
  const prompt = buildSpecialistPrompt(context);

  assert.ok(context.includes('weeks') && context.includes('keySessions'));
  assert.match(prompt, /800m|1500m/i);
  assert.ok(prompt.includes('insufficient data') || prompt.includes('3.1') || prompt.includes('4.2') || prompt.includes('15%'));
  assert.ok(prompt.includes('raw streams') || prompt.includes('unprocessed Strava data'));
  assert.ok(!prompt.includes('split timestamps') && !prompt.includes('heart_rate from the raw stream'));
}

console.log(`AI coach eval passed for ${scenarios.length} scenarios.`);
