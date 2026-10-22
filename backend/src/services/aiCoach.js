import { z } from 'zod';
import { Op } from 'sequelize';
import Activity from '../models/Activity.js';
import Goal from '../models/Goal.js';
import User from '../models/User.js';
import RacePB from '../models/RacePB.js';
import { complete, parseJsonOutput } from './llmClient.js';
import { buildCoachContext, buildSpecialistPrompt } from './contextBuilder.js';
import { classifySession, computeIntervalQuality, computeWeeklyAnalysis } from './analysis.js';
import { buildToolResultForPrompt, buildToolSystemPrompt } from './coachTools.js';

export function buildRecentTrainingProfile(activities = []) {
  const validRuns = [...activities]
    .filter((activity) => activity && activity.date && (Number(activity.distance || 0) > 0 || Number(activity.movingTime || 0) > 0))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const recentRuns = validRuns.slice(0, 12);
  const recentPaces = recentRuns
    .map((run) => Number(run.pace ?? run.averagePace ?? 0))
    .filter((pace) => Number.isFinite(pace) && pace > 0);
  const recentHr = recentRuns
    .map((run) => Number(run.averageHeartrate ?? 0))
    .filter((hr) => Number.isFinite(hr) && hr > 0);

  const avgPace = recentPaces.length ? recentPaces.reduce((sum, pace) => sum + pace, 0) / recentPaces.length : 0;
  const avgHeartRate = recentHr.length ? recentHr.reduce((sum, hr) => sum + hr, 0) / recentHr.length : 0;
  const minPace = recentPaces.length ? Math.min(...recentPaces) : 0;
  const maxPace = recentPaces.length ? Math.max(...recentPaces) : 0;

  const recentQualityPaces = recentRuns
    .map((run) => {
      const pace = Number(run.pace ?? run.averagePace ?? 0);
      const heartRate = Number(run.averageHeartrate ?? 0);
      if (!Number.isFinite(pace) || pace <= 0) return null;
      return { pace, heartRate, distanceKm: Number((Number(run.distance || 0) / 1000).toFixed(2)) };
    })
    .filter(Boolean);

  return {
    recentRuns: recentRuns.length,
    avgPace,
    avgHeartRate,
    recentPaceRange: {
      min: minPace,
      max: maxPace
    },
    recentQualityPaces
  };
}

const RacePredictionSchema = z.object({
  '800m': z.string(),
  '5K': z.string(),
  '10K': z.string(),
  halfMarathon: z.string(),
  marathon: z.string(),
  confidence: z.string()
});

const TrainingPlanSchema = z.object({
  weeks: z.array(z.object({
    weekNumber: z.number(),
    totalDistance: z.number(),
    runs: z.array(z.object({
      day: z.string(),
      type: z.string(),
      distance: z.number(),
      description: z.string()
    }))
  }))
});

async function aiComplete({ system, messages, max_tokens = 1024, feature = 'coach', schema }) {
  return complete({
    system,
    messages,
    maxTokens: max_tokens,
    feature,
    schema
  });
}


/**
 * Analyze training data and provide insights
 */
export async function analyzeTraining(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const activities = await Activity.findAll({
    where: {
      userId,
      date: { [Op.gte]: startDate }
    },
    order: [['date', 'DESC']]
  });
  
  // Calculate key metrics
  const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
  const totalRuns = activities.length;
  const weeklyAverage = (totalDistance / days) * 7;
  
  const paces = activities
    .filter(a => a.pace)
    .map(a => a.pace);
  const averagePace = paces.length > 0 
    ? paces.reduce((sum, p) => sum + p, 0) / paces.length 
    : 0;
  
  // Detect patterns
  const recentActivities = activities.slice(0, 7);
  const hasConsistentTraining = recentActivities.length >= 3;
  const hasLongRun = activities.some(a => (a.distance || 0) > 15000); // 15km+
  
  // Calculate training load trends
  const weeklyDistances = [];
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() - 7);
    
    const weekActivities = activities.filter(a => 
      a.date >= weekEnd && a.date < weekStart
    );
    const weekDistance = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
    weeklyDistances.push(weekDistance);
  }
  
  // Check for overtraining (sudden spike in volume)
  const currentWeek = weeklyDistances[0];
  const previousWeek = weeklyDistances[1];
  const overtrainingRisk = currentWeek > previousWeek * 1.3; // >30% increase
  
  return {
    totalDistance,
    totalRuns,
    weeklyAverage,
    averagePace,
    hasConsistentTraining,
    hasLongRun,
    weeklyDistances,
    overtrainingRisk,
    activities: activities.slice(0, 10) // Last 10 activities
  };
}

/**
 * Generate AI coaching insights
 */
export async function generateCoachingInsights(userId, userMessage = null) {
  const analysis = await analyzeTraining(userId);
  const goals = await Goal.findAll({ 
    where: { userId, status: 'active' } 
  });
  
  // Build context for the AI
  const context = `
You are an experienced running coach analyzing a runner's training data.

Training Summary (last 30 days):
- Total distance: ${analysis.totalDistance.toFixed(1)} km
- Total runs: ${analysis.totalRuns}
- Weekly average: ${analysis.weeklyAverage.toFixed(1)} km
- Average pace: ${formatPace(analysis.averagePace)}
- Recent weekly distances: ${analysis.weeklyDistances.map(d => d.toFixed(1)).join('km, ')} km
- Consistent training: ${analysis.hasConsistentTraining ? 'Yes' : 'No'}
- Has long runs: ${analysis.hasLongRun ? 'Yes' : 'No'}
- Overtraining risk: ${analysis.overtrainingRisk ? 'Yes - sudden volume increase detected' : 'No'}

Recent Activities (oldest to newest):
${analysis.activities.slice(0, 5).reverse().map(a => 
  `- ${a.date.toISOString().split('T')[0]}: ${a.name} - ${(a.distance / 1000).toFixed(2)}km at ${formatPace(a.pace)}`
).join('\n')}

Active Goals:
${goals.length > 0 ? goals.map(g => `- ${g.title} (${g.type})`).join('\n') : 'No active goals'}

${userMessage ? `Runner's question: ${userMessage}` : ''}

Use only the actual training details in this prompt. Interpret the data and focus on patterns, consistency, workload balance, long-run support, pacing, and recovery. You may include numbers only when they help explain the coaching insight, but do not turn the answer into a raw stats recap. Do not invent mileage, race times, or generic coaching phrases. Start with the exact marker "bullets:" and then provide EXACTLY 4-6 bullet points, each starting with "- " and containing one short sentence that is a coaching insight based on the data. Use only the content after "bullets:". Ignore any earlier text, instructions, headers, or notes. Do not include any reasoning, analysis, thought process, hidden steps, explanations, or self-commentary. Never repeat phrases like "we need", "must", "no extra text", "exactly 4-6", "bullet points", "coach insights", "this is the output", "use only actual training details", "no greetings", or similar instructions. Do not use phrases like "I think", "I believe", "this suggests", "it seems", "it appears", "maybe", "probably", "we should", or "analysis". If you cannot give a clean bullet-only answer, return nothing. No introductions, no conclusions, no headers, no paragraphs, no extra text, no emojis, no markdown.
`;

  try {
    const completion = await aiComplete({
      system: 'You are a running coach. You MUST respond with only 4-6 bullet points starting with "- ". One short sentence per bullet. No greetings, no sign-offs, no headers, no paragraphs, no emojis, no markdown. Just bullet points.',
      messages: [
        { role: 'system', content: 'You are a running coach using only the runner\'s actual training data. Start with the exact marker "bullets:" and then return only 4-6 bullet points starting with "- ". Each bullet must be a brief coaching insight grounded in the training pattern, and numbers may be included only when they support the insight. Ignore all earlier instruction text, headings, and notes. Do not include any reasoning, analysis, thought process, hidden steps, explanations, or meta-language. Never echo or restate instructions such as "we need", "must", "no extra text", "exactly 4-6", "bullet points", "coach insights", "this is the output", "use only actual training details", or "no greetings". Do not use phrases like "I think", "I believe", "this suggests", "it seems", "it appears", "maybe", "probably", "we should", or "analysis". If you cannot provide a clean bullet-only answer, return nothing. No greetings, no sign-offs, no headers, no paragraphs, no markdown, no emoji.' },
        { role: 'user', content: context }
      ],
      max_tokens: 250,
      feature: 'insights'
    });

    const rawInsights = completion || 'No insights available.';
    return {
      insights: normalizeInsightBullets(rawInsights),
      analysis
    };
  } catch (error) {
    console.error('Error generating coaching insights:', error);
    throw error;
  }
}

/**
 * Chat with AI coach
 */
export async function chatWithCoach(userId, message, conversationHistory = []) {
  const activities = await Activity.findAll({
    where: { userId },
    order: [['date', 'DESC']]
  });
  const goals = await Goal.findAll({
    where: { userId, status: 'active' }
  });

  const recentActivities = activities.slice(0, 20);
  const weeks = Array.from({ length: 8 }, (_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (idx * 7 + 1));
    const weekStart = new Date(date);
    weekStart.setHours(0, 0, 0, 0);
    const sunday = new Date(weekStart);
    sunday.setDate(weekStart.getDate() - weekStart.getDay() + 7);

    const weekRuns = recentActivities.filter((activity) => {
      const eventDate = new Date(activity.date);
      const start = new Date(sunday);
      start.setDate(sunday.getDate() - 6);
      return eventDate >= start && eventDate <= sunday;
    });

    const summary = computeWeeklyAnalysis(weekRuns);
    return {
      weekStart: formatDateKey(startOfWeekFromDate(sunday)),
      totalDistanceKm: summary.totalDistanceKm,
      sessionCount: summary.sessionCount,
      acwr: 1.0,
      load: summary.load,
      intensity: summary.intensityMinutes
    };
  }).reverse();

  const keySessions = recentActivities.slice(0, 5).map((activity) => {
    const sessionType = classifySession(activity);
    const interval = computeIntervalQuality(activity);
    return {
      sessionType,
      repCount: interval.repCount,
      fadePercent: interval.fadePercent,
      quality: interval.quality,
      durationMinutes: Math.round((Number(activity.movingTime || 0) / 60) || 0),
      summary: `${sessionType} session, ${Number(((activity.distance || 0) / 1000)).toFixed(1)} km`
    };
  });

  const athleteContext = {
    athlete: {
      focus: ['800m', '1500m'],
      weeklyVolumeKm: Math.round((recentActivities.reduce((sum, activity) => sum + ((activity.distance || 0) / 1000), 0) / Math.max(recentActivities.length || 1, 1)) * 7),
      keySessions: ['Tue', 'Thu', 'Sat', 'Sun'],
      trainingBlock: 'build'
    },
    goals: goals.map((goal) => ({
      title: goal.title,
      type: goal.type,
      raceDate: goal.raceDate,
      targetTime: goal.targetTime,
      targetDistance: goal.targetDistance
    })),
    weeks,
    keySessions,
    upcomingRaces: goals
      .filter((goal) => goal.raceDate || goal.type === 'race')
      .map((goal) => ({
        name: goal.title,
        date: goal.raceDate,
        distance: goal.targetDistance || null
      })),
    analysis: {
      weeklyTrend: 'stable',
      buildDeload: 'insufficient_data',
      fatigueRisk: 'insufficient_data',
      raceReadiness: 'insufficient_data'
    }
  };

  const compactContext = buildCoachContext(athleteContext);
  const messageContext = buildToolResultForPrompt(message, recentActivities);
  const toolContext = messageContext ? `\nTool result:\n${JSON.stringify(messageContext.result, null, 2)}` : '';

  const systemContext = `${buildSpecialistPrompt(compactContext)}\n\n${buildToolSystemPrompt()}`;

  try {
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: `${message}${toolContext}` }
    ];

    const completion = await aiComplete({
      system: systemContext,
      messages,
      max_tokens: 800,
      feature: 'chat'
    });

    return stripFormatting(completion || 'Sorry, I couldn\'t process that. Can you try rephrasing?');
  } catch (error) {
    console.error('Error in AI chat:', error);
    throw error;
  }
}

/**
 * Predict race times based on training
 */
export async function predictRaceTimes(userId) {
  const activities = await Activity.findAll({
    where: {
      userId,
      date: { [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    },
    order: [['date', 'DESC']]
  });
  const analysis = await analyzeTraining(userId, 90);
  const profile = buildRecentTrainingProfile(activities);

  // Get user's race PBs
  const pbs = await RacePB.findAll({
    where: { userId },
    order: [['date', 'DESC']]
  });

  const hasUsefulRecentData = profile.recentRuns >= 4 || (analysis.totalRuns >= 10 && profile.avgPace > 0);
  if (!hasUsefulRecentData && pbs.length === 0) {
    return { error: 'Need more training data or race PBs for accurate predictions' };
  }

  const racePBsText = pbs.length > 0
    ? `\nCurrent Personal Bests:\n${pbs.map(pb => 
        `- ${pb.distance}: ${formatTime(pb.time)} (${new Date(pb.date).toLocaleDateString()})`
      ).join('\n')}`
    : '';

  const paceRangeText = profile.recentRuns > 0
    ? `\nRecent training profile (last 12 runs):\n- Recent runs: ${profile.recentRuns}\n- Avg pace: ${formatPace(profile.avgPace)}\n- Avg HR: ${Math.round(profile.avgHeartRate || 0)} bpm\n- Pace range: ${formatPace(profile.recentPaceRange.min)} to ${formatPace(profile.recentPaceRange.max)}\n- Quality sessions: ${profile.recentQualityPaces.length}`
    : '\nRecent training profile: insufficient recent running data';

  const context = `
Based on this runner's recent training data from the last 90 days, predict realistic race times.

Training Summary:
- Total distance: ${analysis.totalDistance.toFixed(1)} km
- Total runs: ${analysis.totalRuns}
- Average pace: ${formatPace(analysis.averagePace)}
- Weekly average: ${analysis.weeklyAverage.toFixed(1)} km
- Recent consistency: ${profile.recentRuns} recent runs with ${Math.round(profile.avgHeartRate || 0)} bpm average HR${paceRangeText}${racePBsText}

Provide realistic time predictions for:
- 800m
- 5K
- 10K
- Half Marathon (21.1km)
- Marathon (42.2km)

${pbs.length > 0 ? 'Use the runner\'s PBs as the primary reference and adjust for current fitness using the recent pace/HR trend.' : 'Base predictions on the runner\'s recent training pace, volume, and aerobic fitness.'}

Format your response as JSON with this structure:
{
  "800m": "MM:SS",
  "5K": "MM:SS",
  "10K": "MM:SS",
  "halfMarathon": "HH:MM:SS",
  "marathon": "HH:MM:SS",
  "confidence": "Description of prediction confidence"
}
`;

  try {
    const completion = await aiComplete({
      system: 'You are a running coach expert at predicting race times based on training data. Provide realistic, achievable predictions.',
      messages: [
        { role: 'user', content: context }
      ],
      max_tokens: 500,
      feature: 'race_predictions',
      schema: RacePredictionSchema
    });

    return completion;
  } catch (error) {
    console.error('Error predicting race times:', error);
    throw error;
  }
}

/**
 * Generate training plan for a goal
 */
function getMondaySundayMileage(activities = []) {
  const buckets = new Map();

  activities.forEach((activity) => {
    if (!activity?.date) return;
    const date = new Date(activity.date);
    const weekStart = startOfWeekFromDate(date);
    const key = formatDateKey(weekStart);

    if (!buckets.has(key)) {
      buckets.set(key, 0);
    }

    buckets.set(key, buckets.get(key) + (Number(activity.distance || 0) / 1000));
  });

  return [...buckets.entries()]
    .map(([weekStart, totalDistanceKm]) => ({
      weekStart,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1))
    }))
    .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
}

function buildNextWeeksTrainingPlan(activities = [], goal = {}) {
  const recentWeeks = getMondaySundayMileage(activities);
  const recentVolume = recentWeeks.length
    ? recentWeeks.slice(-4).reduce((sum, week) => sum + week.totalDistanceKm, 0) / Math.min(recentWeeks.slice(-4).length, 4)
    : 35;
  const baseWeeklyDistance = Math.max(25, Number((recentVolume || 35).toFixed(1)));
  const targetWeeklyDistance = Math.max(25, baseWeeklyDistance + (goal?.goalType === 'race' ? 8 : 0));

  const days = [
    { day: 'Monday', type: 'Easy', ratio: 0.16 },
    { day: 'Tuesday', type: 'Workout', ratio: 0.17 },
    { day: 'Wednesday', type: 'Recovery', ratio: 0.12 },
    { day: 'Thursday', type: 'Tempo', ratio: 0.18 },
    { day: 'Friday', type: 'Easy', ratio: 0.1 },
    { day: 'Saturday', type: 'Long', ratio: 0.22 },
    { day: 'Sunday', type: 'Easy', ratio: 0.05 }
  ];

  return Array.from({ length: 4 }, (_, index) => {
    const weekDistance = Number((targetWeeklyDistance * (1 + index * 0.05)).toFixed(1));

    const runs = days.map((run) => {
      const distance = Number((weekDistance * run.ratio / 1.1).toFixed(1));
      const description = run.type === 'Workout'
        ? 'Track or hill repetitions with controlled effort and relaxed recovery.'
        : run.type === 'Tempo'
          ? 'Threshold work with a steady rhythm and relaxed form.'
          : run.type === 'Long'
            ? 'Long aerobic run with smooth pacing and time on feet.'
            : run.type === 'Recovery'
              ? 'Short shakeout to keep legs fresh and moving.'
              : 'Easy aerobic mileage to support consistency and recovery.';

      return {
        day: run.day,
        type: run.type,
        distance,
        description
      };
    });

    const lastRunIndex = runs.length - 1;
    const sumOtherDistances = runs.slice(0, lastRunIndex).reduce((sum, item) => sum + item.distance, 0);
    const finalDistance = Number((Math.max(3, weekDistance - sumOtherDistances)).toFixed(1));
    runs[lastRunIndex] = { ...runs[lastRunIndex], distance: finalDistance };

    return {
      weekNumber: index + 1,
      totalDistance: weekDistance,
      runs
    };
  });
}

export async function generateTrainingPlan(userId, goalId) {
  const goal = goalId ? await Goal.findByPk(goalId) : null;
  const activities = await Activity.findAll({
    where: {
      userId,
      date: { [Op.gte]: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) }
    },
    order: [['date', 'DESC']]
  });
  const analysis = await analyzeTraining(userId, 90);

  if (!goal && activities.length === 0) {
    throw new Error('Need recent Strava data before generating a plan');
  }

  const goalConfig = goal || {
    title: 'Next 4-week build block',
    type: 'custom',
    raceType: '5K',
    targetTime: null,
    raceDate: null
  };

  const weeksUntilGoal = goalConfig.raceDate
    ? Math.ceil((goalConfig.raceDate - new Date()) / (7 * 24 * 60 * 60 * 1000))
    : 4;

  const plan = buildNextWeeksTrainingPlan(activities, { goalType: goalConfig.type });
  const context = `
Create a ${Math.max(weeksUntilGoal, 4)}-week training plan for this goal:
- Goal: ${goalConfig.title}
- Type: ${goalConfig.type}
- Race type: ${goalConfig.raceType || 'N/A'}
- Target time: ${goalConfig.targetTime || 'N/A'}

Current training level:
- Weekly average: ${analysis.weeklyAverage.toFixed(1)} km
- Average pace: ${formatPace(analysis.averagePace)}
- Monday-Sunday mileage trend: ${getMondaySundayMileage(activities).slice(-4).map((week) => `${week.weekStart}: ${week.totalDistanceKm}km`).join(' | ') || 'No recent week tracking yet'}

Base the plan on the athlete's recent training volume and keep all weeks aligned to Monday-Sunday tracking.

IMPORTANT: Respond with ONLY valid JSON, no additional text or markdown. Use this exact structure:
{
  "weeks": [
    {
      "weekNumber": 1,
      "totalDistance": 30,
      "runs": [
        {"day": "Monday", "type": "Easy", "distance": 5, "description": "Easy pace recovery run"}
      ]
    }
  ]
}

Make sure:
- No trailing commas after the last item in arrays or objects
- All strings are properly quoted
- All property names are in double quotes
- Numbers are not quoted
- The plan should cover ${Math.max(weeksUntilGoal, 4)} weeks, with the first week grounded in the runner's recent Monday-Sunday mileage.
`;

  try {
    const completion = await aiComplete({
      system: 'You are an expert running coach. You MUST respond with valid JSON only, no markdown, no explanations, just pure JSON. Keep all weekly mileage anchored to Monday-to-Sunday pacing and recovery balance.',
      messages: [{ role: 'user', content: context }],
      max_tokens: 2000,
      feature: 'training_plan',
      schema: TrainingPlanSchema
    });

    return completion || { weeks: plan };
  } catch (error) {
    console.error('Error generating training plan:', error);
    return { weeks: plan };
  }
}

// Strip emojis, markdown formatting, and special characters from AI responses
function stripFormatting(text) {
  if (!text) return text;
  return text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}\u{200D}\u{20E3}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}]/gu, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/\|/g, '')
    .replace(/---+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeInsightBullets(text) {
  const raw = stripFormatting(text || '').replace(/\r/g, '');
  const candidate = (() => {
    const markerMatch = raw.match(/\bbullets\s*:\s*([\s\S]*)/i);
    return markerMatch ? markerMatch[1] : raw;
  })();

  const lines = candidate
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  const rejectPattern = /(coach insights|we need|must|no extra text|exactly 4-6|bullet points|use only actual training details|no greetings|i think|i believe|this suggests|it seems|it appears|maybe|probably|we should|analysis|reasoning|thought process|summary|based on the data|in summary|overall summary)/i;

  const bullets = [];
  for (const line of lines) {
    if (rejectPattern.test(line)) continue;
    if (/^(here|overall|summary|check|compare|review|consider)/i.test(line)) continue;
    if (line.length < 20) continue;

    const clean = line
      .replace(/^['\"“”]+|['\"“”]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) continue;
    const finalLine = clean.endsWith('.') || clean.endsWith('!') || clean.endsWith('?') ? clean : `${clean}.`;
    bullets.push(`- ${finalLine}`);

    if (bullets.length >= 6) break;
  }

  if (bullets.length >= 1 && bullets.length <= 6) {
    return bullets.join('\n');
  }

  const fallbackBullets = lines
    .filter(line => !rejectPattern.test(line))
    .filter(line => !/^(here|overall|summary|the runner|coach|training summary)/i.test(line))
    .map(line => {
      const clean = line.replace(/^['\"“”]+|['\"“”]+$/g, '').replace(/\s+/g, ' ').trim();
      return `- ${clean.endsWith('.') || clean.endsWith('!') || clean.endsWith('?') ? clean : `${clean}.`}`;
    })
    .slice(0, 6);

  return fallbackBullets.length >= 1 && fallbackBullets.length <= 6 ? fallbackBullets.join('\n') : '';
}

// Helper function to format pace
function formatPace(pace) {
  if (!pace || pace === 0) return 'N/A';
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
}

// Helper function to format time in seconds to HH:MM:SS or MM:SS
function formatTime(seconds) {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Voice coaching - emotionally intelligent AI response
 * Analyzes runner's voice transcript to detect emotional state and provide empathetic coaching
 */
export async function voiceCoaching(userId, transcript, activityData, activityId) {
  try {
    // Get user data for context
    const user = await User.findByPk(userId);
    
    // Analyze emotional tone from transcript
    const emotion = detectEmotion(transcript);
    
    // Get recent training context
    const recentActivities = await Activity.findAll({
      where: { userId },
      order: [['date', 'DESC']],
      limit: 5
    });
    
    // Build context for AI
    const activityContext = activityData ? `
Activity Details:
- Distance: ${activityData.distance?.toFixed(2)} km
- Duration: ${activityData.duration?.toFixed(0)} minutes
- Pace: ${activityData.pace ? formatPace(activityData.pace) : 'N/A'}
- Heart Rate: ${activityData.heartRate ? Math.round(activityData.heartRate) + ' bpm' : 'N/A'}
- Elevation Gain: ${activityData.elevationGain ? Math.round(activityData.elevationGain) + 'm' : 'N/A'}
` : '';

    const recentContext = recentActivities.length > 0 ? `
Recent Training History:
${recentActivities.map((a, i) => 
  `${i + 1}. ${format(new Date(a.date), 'MMM d')}: ${(a.distance / 1000).toFixed(1)}km in ${Math.round(a.movingTime / 60)}min`
).join('\n')}
` : '';

    const emotionContext = `
Detected Emotional Tone: ${emotion.label}
Confidence Indicators: ${emotion.indicators.join(', ')}
`;

    const prompt = `You are an empathetic AI running coach having a voice conversation with a runner immediately after their workout. They just finished speaking to you about their run.

${activityContext}
${recentContext}
${emotionContext}

Runner's Feedback (what they just said):
"${transcript}"

IMPORTANT INSTRUCTIONS:
1. Respond as if you're a real coach who just listened to them speak
2. Match their emotional energy - if they sound excited, be enthusiastic; if tired, be understanding
3. Acknowledge specific things they mentioned
4. Provide brief, conversational coaching advice (2-3 sentences max)
5. Use natural speech patterns - short sentences, contractions, conversational tone
6. Show empathy based on the detected emotion
7. Don't just state metrics - respond to how they FEEL about the run

Respond naturally and warmly, like a coach who genuinely cares:`;

    const completion = await aiComplete({
      system: 'You are an emotionally intelligent running coach who excels at voice-based coaching conversations. You understand both the physical and emotional aspects of running. Keep responses conversational, brief (2-3 sentences), and empathetic. Never use emojis or special characters.',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      feature: 'voice_coaching'
    });

    const message = stripFormatting(completion || "Great job out there! Keep up the good work.");

    return {
      message: message.trim(),
      emotion: emotion.label,
      emotionConfidence: emotion.confidence
    };
  } catch (error) {
    console.error('Error in voice coaching:', error);
    throw error;
  }
}

/**
 * Detect emotional tone from transcript text
 * Returns emotion label and confidence indicators
 */
function detectEmotion(transcript) {
  const text = transcript.toLowerCase();
  
  // Positive emotion indicators
  const excitedWords = ['amazing', 'awesome', 'great', 'fantastic', 'love', 'loved', 'best', 'excellent', 'strong', 'crushed', 'nailed', 'felt good', 'wonderful'];
  const proudWords = ['proud', 'accomplished', 'achievement', 'personal best', 'PR', 'pb', 'beat my time'];
  
  // Negative emotion indicators
  const frustratedWords = ['frustrated', 'disappointed', 'annoyed', 'angry', 'terrible', 'awful', 'horrible', 'worst'];
  const tiredWords = ['exhausted', 'tired', 'drained', 'dead', 'spent', 'wiped', 'burned out'];
  const strugglingWords = ['struggled', 'difficult', 'hard', 'tough', 'challenging', 'suffering', 'pain'];
  
  // Neutral/Reflective indicators
  const reflectiveWords = ['okay', 'alright', 'fine', 'decent', 'not bad', 'average', 'normal'];
  
  // Count matches
  const excitedCount = excitedWords.filter(w => text.includes(w)).length;
  const proudCount = proudWords.filter(w => text.includes(w)).length;
  const frustratedCount = frustratedWords.filter(w => text.includes(w)).length;
  const tiredCount = tiredWords.filter(w => text.includes(w)).length;
  const strugglingCount = strugglingWords.filter(w => text.includes(w)).length;
  const reflectiveCount = reflectiveWords.filter(w => text.includes(w)).length;
  
  // Check for exclamation marks (excitement indicator)
  const exclamationCount = (transcript.match(/!/g) || []).length;
  
  const indicators = [];
  let emotion = 'neutral';
  let confidence = 'medium';
  
  if (excitedCount > 0 || proudCount > 0 || exclamationCount >= 2) {
    emotion = 'excited/proud';
    indicators.push('positive language', 'enthusiasm');
    confidence = 'high';
  } else if (frustratedCount > 0) {
    emotion = 'frustrated';
    indicators.push('frustration indicators');
    confidence = 'high';
  } else if (tiredCount > 0 || strugglingCount > 0) {
    emotion = 'tired/struggling';
    indicators.push('fatigue language', 'challenge mentions');
    confidence = 'high';
  } else if (reflectiveCount > 0) {
    emotion = 'reflective';
    indicators.push('neutral language', 'matter-of-fact tone');
    confidence = 'medium';
  } else {
    indicators.push('no strong emotion indicators');
    confidence = 'low';
  }
  
  return {
    label: emotion,
    confidence,
    indicators
  };
}

function format(date, formatStr) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  
  if (formatStr === 'MMM d') {
    return `${month} ${day}`;
  }
  return date.toLocaleDateString();
}

function startOfWeekFromDate(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  return start;
}

function formatDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

