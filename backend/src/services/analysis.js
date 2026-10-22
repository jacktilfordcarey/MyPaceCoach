function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function safeMean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function coefficientOfVariation(values) {
  if (!values.length) return 0;
  const mean = safeMean(values);
  if (!mean) return 0;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function toSecondsFromPace(paceMinPerKm) {
  if (!paceMinPerKm || Number.isNaN(paceMinPerKm)) return 0;
  return paceMinPerKm * 60;
}

function computeDistanceKm(activity) {
  const distance = Number(activity.distance ?? 0);
  return Number((distance / 1000).toFixed(3));
}

function computePaceMinutesPerKm(activity) {
  if (Number.isFinite(activity.pace) && activity.pace > 0) return Number(activity.pace);
  if (Number.isFinite(activity.averagePace) && activity.averagePace > 0) return Number(activity.averagePace);

  const distanceKm = computeDistanceKm(activity);
  const movingSeconds = Number(activity.movingTime ?? activity.elapsedTime ?? 0);
  if (!distanceKm || !movingSeconds) return null;
  return (movingSeconds / 60) / distanceKm;
}

export function classifySession(activity) {
  const distanceKm = computeDistanceKm(activity);
  const pace = computePaceMinutesPerKm(activity);
  const heartRate = Number(activity.averageHeartrate ?? 0);

  if (activity.isRace) return 'race';

  const splits = Array.isArray(activity.splits) ? activity.splits : [];
  const splitPaces = splits
    .filter((split) => Number(split.average_speed) > 0)
    .map((split) => 1000 / Number(split.average_speed));

  const splitTimes = splits
    .filter((split) => Number(split.elapsed_time) > 0)
    .map((split) => Number(split.elapsed_time));

  const variance = splitPaces.length > 1 ? coefficientOfVariation(splitPaces) :
    splitTimes.length > 1 ? coefficientOfVariation(splitTimes.map((time) => time / 60)) : 0;

  const hasRepWork = splitPaces.length >= 3 || splitTimes.length >= 3 || (distanceKm > 2 && pace && pace < 4.5);

  if (hasRepWork && (pace && pace <= 4.8 || variance > 0.04 || heartRate >= 165)) {
    return 'interval';
  }

  if (distanceKm >= 12 && pace && pace >= 5.0) return 'long';
  if (heartRate >= 165 && pace && pace < 4.7) return 'speed';
  if (heartRate >= 155 && pace && pace <= 4.4) return 'threshold';

  return 'easy';
}

export function computeIntervalQuality(activity) {
  const splits = Array.isArray(activity.splits) ? activity.splits : [];
  if (!splits.length) {
    return {
      repCount: 0,
      repPaces: [],
      fadePercent: 0,
      consistencyCv: 0,
      recoverySeconds: 0,
      recoveryHrDrop: 0,
      quality: 'insufficient_data'
    };
  }

  const splitTimes = splits
    .map((split) => Number(split.elapsed_time || 0))
    .filter((value) => value > 0);

  const repPaces = splitTimes.map((time) => (time / 60) / (Number(splitTimes.length) || 1));
  const firstRep = repPaces[0] ?? 0;
  const lastRep = repPaces[repPaces.length - 1] ?? 0;
  const fadePercent = firstRep ? ((lastRep - firstRep) / firstRep) * 100 : 0;
  const cv = coefficientOfVariation(repPaces);
  const recoverySeconds = Number(activity.recoverySeconds ?? 0);
  const recoveryHrDrop = Number(activity.hrRecovery ?? 0);

  return {
    repCount: splitTimes.length,
    repPaces,
    fadePercent: Number(fadePercent.toFixed(2)),
    consistencyCv: Number(cv.toFixed(4)),
    recoverySeconds,
    recoveryHrDrop,
    quality: cv < 0.04 ? 'consistent' : cv < 0.08 ? 'moderate' : 'fading'
  };
}

export function computeWeeklyAnalysis(weekRuns = []) {
  const totalDistanceKm = weekRuns.reduce((sum, run) => sum + computeDistanceKm(run), 0);
  const sessionCount = weekRuns.length;
  const load = weekRuns.reduce((sum, run) => {
    const distanceKm = computeDistanceKm(run);
    const hr = Number(run.averageHeartrate ?? 0);
    const pace = computePaceMinutesPerKm(run) ?? 5;
    const relativeIntensity = clamp((hr ? hr / 180 : 0) + (pace ? (5.5 - pace) / 3 : 0));
    return sum + Math.max(distanceKm * 1.2, distanceKm * relativeIntensity * 2.4);
  }, 0);

  const easyMinutes = weekRuns
    .filter((run) => classifySession(run) === 'easy')
    .reduce((sum, run) => sum + Number(run.movingTime || 0) / 60, 0);

  const thresholdMinutes = weekRuns
    .filter((run) => classifySession(run) === 'threshold')
    .reduce((sum, run) => sum + Number(run.movingTime || 0) / 60, 0);

  const aboveThresholdMinutes = weekRuns
    .filter((run) => ['interval', 'speed', 'race'].includes(classifySession(run)))
    .reduce((sum, run) => sum + Number(run.movingTime || 0) / 60, 0);

  const totalMinutes = Math.max(1, weekRuns.reduce((sum, run) => sum + Number(run.movingTime || 0) / 60, 0));
  const easyRatio = easyMinutes / totalMinutes;
  const thresholdRatio = thresholdMinutes / totalMinutes;
  const aboveThresholdRatio = aboveThresholdMinutes / totalMinutes;

  const polarisationRatio = (aboveThresholdRatio + 0.01) / (easyRatio + 0.01);

  return {
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    sessionCount,
    load: Number(load.toFixed(1)),
    acwr: 1.0,
    monotony: 1.0,
    strain: Number((load * 1.2).toFixed(1)),
    polarisationRatio: Number(polarisationRatio.toFixed(3)),
    intensityMinutes: {
      easy: Number(easyMinutes.toFixed(1)),
      threshold: Number(thresholdMinutes.toFixed(1)),
      aboveThreshold: Number(aboveThresholdMinutes.toFixed(1))
    },
    easyRatio: Number(easyRatio.toFixed(3)),
    thresholdRatio: Number(thresholdRatio.toFixed(3)),
    aboveThresholdRatio: Number(aboveThresholdRatio.toFixed(3))
  };
}

export function detectBuildDeloadCycle(weeks = []) {
  const sorted = [...weeks].sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
  if (sorted.length < 4) {
    return {
      cyclePattern: 'insufficient_data',
      skippedDeload: false,
      volumeJump: 0,
      notes: 'Not enough weeks to detect the 3:1 pattern.'
    };
  }

  const volumeJumps = sorted.slice(1).map((week, index) => {
    const prev = sorted[index];
    return prev.totalDistanceKm ? (week.totalDistanceKm - prev.totalDistanceKm) / prev.totalDistanceKm : 0;
  });

  const maxJump = Math.max(...volumeJumps, 0);
  const skippedDeload = sorted.slice(0, 4).some((week, index, arr) => {
    if (index >= 3) return false;
    const next = arr[index + 1];
    return next && next.totalDistanceKm > week.totalDistanceKm * 1.1;
  });

  return {
    cyclePattern: '3:1',
    skippedDeload,
    volumeJump: Number(maxJump.toFixed(3)),
    notes: skippedDeload ? 'A deload appears to have been skipped or volume jumped materially.' : 'Training rhythm appears consistent with a 3:1 build-deload pattern.'
  };
}

export function compareBlocks(currentBlock = [], previousBlock = []) {
  const currentVolume = currentBlock.reduce((sum, run) => sum + computeDistanceKm(run), 0);
  const previousVolume = previousBlock.reduce((sum, run) => sum + computeDistanceKm(run), 0);
  const deltaVolumePercent = previousVolume ? ((currentVolume - previousVolume) / previousVolume) * 100 : 0;

  const currentLoad = computeWeeklyAnalysis(currentBlock).load;
  const previousLoad = computeWeeklyAnalysis(previousBlock).load;
  const deltaLoadPercent = previousLoad ? ((currentLoad - previousLoad) / previousLoad) * 100 : 0;

  return {
    deltaVolumePercent: Number(deltaVolumePercent.toFixed(1)),
    deltaSessionCount: currentBlock.length - previousBlock.length,
    deltaLoadPercent: Number(deltaLoadPercent.toFixed(1)),
    summary: currentVolume > previousVolume
      ? 'Current block is running higher volume and load than the previous block.'
      : 'Current block is slightly below the previous block on volume and load.'
  };
}

export function computeRaceSpecificIndicators(activities = [], goalConfig = {}) {
  const target800m = Number(goalConfig.target800m ?? 150);
  const target1500m = Number(goalConfig.target1500m ?? 240);

  const volumeAtGoalPace = activities.reduce((sum, run) => {
    const distanceKm = computeDistanceKm(run);
    const pace = computePaceMinutesPerKm(run);
    if (!pace) return sum;
    const paceSeconds = toSecondsFromPace(pace);
    const inGoalWindow = paceSeconds <= target800m || paceSeconds <= target1500m;
    return sum + (inGoalWindow ? distanceKm : 0);
  }, 0);

  const speedEnduranceSessions = activities.filter((run) => {
    const pace = computePaceMinutesPerKm(run);
    return Number(run.distance || 0) >= 2000 && pace && pace <= 4.8;
  }).length;

  const topEndSessions = activities.filter((run) => {
    const pace = computePaceMinutesPerKm(run);
    return pace && pace < 3.8 && (Number(run.distance || 0) >= 1000 || run.type === 'Workout');
  }).length;

  return {
    volumeAtGoalPace: Number(volumeAtGoalPace.toFixed(1)),
    speedEnduranceSessions,
    topEndSessions,
    goalWindowSeconds: { target800m, target1500m }
  };
}
