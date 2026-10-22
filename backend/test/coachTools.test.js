import test from 'node:test';
import assert from 'node:assert/strict';

import { getWeekSummary, getSessionDetail, compareBlockSummary, buildToolResultForPrompt, COACH_TOOLS_SCHEMA } from '../src/services/coachTools.js';
import { buildCoachContext, buildSpecialistPrompt } from '../src/services/contextBuilder.js';

const sampleActivities = [
  {
    date: '2026-06-08T08:00:00Z',
    name: 'Threshold 4k',
    distance: 6000,
    movingTime: 28 * 60,
    averageHeartrate: 162,
    pace: 4.67,
    splits: [
      { elapsed_time: 60 },
      { elapsed_time: 62 },
      { elapsed_time: 64 }
    ]
  },
  {
    date: '2026-06-10T08:00:00Z',
    name: 'Intervals 6 x 400',
    distance: 2400,
    movingTime: 11 * 60,
    averageHeartrate: 171,
    pace: 4.58,
    splits: [
      { elapsed_time: 58 },
      { elapsed_time: 60 },
      { elapsed_time: 61 },
      { elapsed_time: 63 },
      { elapsed_time: 64 },
      { elapsed_time: 66 }
    ]
  },
  {
    date: '2026-06-13T08:00:00Z',
    name: 'Long run',
    distance: 15000,
    movingTime: 68 * 60,
    averageHeartrate: 150,
    pace: 4.53
  }
];

test('getWeekSummary computes a weekly load summary from the current week', () => {
  const summary = getWeekSummary(sampleActivities, new Date('2026-06-10T12:00:00Z'));

  assert.equal(summary.sessionCount, 3);
  assert.ok(summary.totalDistanceKm > 20);
  assert.ok(summary.load > 0);
  assert.ok(summary.polarisationRatio > 0);
});

test('getSessionDetail returns the correct classification and interval metrics', () => {
  const detail = getSessionDetail(sampleActivities[1]);

  assert.equal(detail.classification, 'interval');
  assert.equal(detail.interval.repCount, 6);
  assert.ok(detail.interval.fadePercent > 0);
});

test('compareBlockSummary reports block deltas', () => {
  const current = sampleActivities;
  const previous = sampleActivities.slice(0, 2);
  const summary = compareBlockSummary(current, previous);

  assert.ok('deltaVolumePercent' in summary);
  assert.ok('deltaSessionCount' in summary);
  assert.ok('summary' in summary);
});

test('buildToolResultForPrompt resolves to the correct tool call', () => {
  const result = buildToolResultForPrompt('Give me my week summary', sampleActivities);

  assert.equal(result.tool, 'get_week_summary');
  assert.ok(result.result);
});

test('coach tool schema exposes the supported tool contract', () => {
  assert.ok(Array.isArray(COACH_TOOLS_SCHEMA));
  assert.ok(COACH_TOOLS_SCHEMA.some((tool) => tool.function.name === 'get_week_summary'));
  assert.ok(COACH_TOOLS_SCHEMA.some((tool) => tool.function.name === 'get_session_detail'));
  assert.ok(COACH_TOOLS_SCHEMA.some((tool) => tool.function.name === 'compare_blocks'));
});

test('specialist prompt includes athlete numbers and a no-guess rule', () => {
  const context = buildCoachContext({
    athlete: {
      focus: ['800m', '1500m'],
      weeklyVolumeKm: 82,
      keySessions: ['Tue', 'Thu', 'Sat'],
      trainingBlock: 'build'
    },
    goals: [{ title: 'Sub-2:00 800m', targetTime: '02:00', type: 'race' }],
    weeks: [
      { weekStart: '2026-06-01', totalDistanceKm: 90, sessionCount: 5, acwr: 1.1, load: 140, intensity: { easy: 140, threshold: 35, aboveThreshold: 30 } },
      { weekStart: '2026-06-08', totalDistanceKm: 78, sessionCount: 4, acwr: 0.93, load: 118, intensity: { easy: 128, threshold: 32, aboveThreshold: 22 } }
    ],
    keySessions: [{ sessionType: 'interval', repCount: 6, fadePercent: 3.1, quality: 'consistent', summary: 'rep 6 was 3.1% slower than rep 1' }],
    upcomingRaces: [{ name: 'Track 1500m', date: '2026-07-15T00:00:00Z' }],
    analysis: { weeklyTrend: 'stable', buildDeload: 'skipped_deload', fatigueRisk: 'moderate', raceReadiness: 'good' }
  });

  const prompt = buildSpecialistPrompt(context);
  assert.match(prompt, /800m|1500m/i);
  assert.match(prompt, /3\.1|insufficient data/i);
  assert.match(prompt, /Do not guess|insufficient data/i);
});
