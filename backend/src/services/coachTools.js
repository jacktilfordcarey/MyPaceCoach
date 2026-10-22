import { classifySession, computeIntervalQuality, computeWeeklyAnalysis, compareBlocks } from './analysis.js';

export const COACH_TOOLS_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'get_week_summary',
      description: 'Return the athlete\'s current week summary with distance, load, ACWR, and intensity split.',
      parameters: {
        type: 'object',
        properties: {
          referenceDate: {
            type: 'string',
            description: 'ISO date string to anchor the week. Defaults to today.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_session_detail',
      description: 'Return classification, interval metrics, and summary for the most recent or selected session.',
      parameters: {
        type: 'object',
        properties: {
          sessionIndex: {
            type: 'integer',
            description: 'Zero-based index for the activity in recent history; default is the most recent session.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compare_blocks',
      description: 'Compare the latest block against the previous block and report volume, session count, and change summary.',
      parameters: {
        type: 'object',
        properties: {
          windowSize: {
            type: 'integer',
            description: 'Number of recent sessions to compare in each block; defaults to 3.'
          },
          referenceDate: {
            type: 'string',
            description: 'ISO date string used to anchor the comparison window.'
          }
        },
        required: []
      }
    }
  }
];

export function buildToolSystemPrompt() {
  return `Use the following tool schema when the athlete asks for a weekly summary, a session detail, or a block comparison. Prefer the tool result when the query matches those requests and cite the exact numbers returned.\n\nAvailable tools:\n${JSON.stringify(COACH_TOOLS_SCHEMA, null, 2)}`;
}

function daysBetween(start, end) {
  return Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
}

export function getWeekSummary(activities = [], referenceDate = new Date()) {
  const startOfWeek = new Date(referenceDate);
  startOfWeek.setHours(0, 0, 0, 0);
  const day = startOfWeek.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);

  const weekRuns = activities.filter((activity) => {
    const date = new Date(activity.date);
    return date >= startOfWeek && date < new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  const summary = computeWeeklyAnalysis(weekRuns);
  return {
    weekStart: startOfWeek.toISOString(),
    sessionCount: summary.sessionCount,
    totalDistanceKm: summary.totalDistanceKm,
    load: summary.load,
    acwr: summary.acwr,
    intensity: summary.intensityMinutes,
    polarisationRatio: summary.polarisationRatio,
    summary
  };
}

export function getSessionDetail(activity) {
  if (!activity) return { status: 'insufficient_data' };

  const classification = classifySession(activity);
  const interval = computeIntervalQuality(activity);

  return {
    date: activity.date,
    name: activity.name,
    classification,
    distanceKm: Number(((activity.distance || 0) / 1000).toFixed(2)),
    paceMinPerKm: activity.pace || activity.averagePace || null,
    averageHeartrate: activity.averageHeartrate || null,
    interval,
    status: 'ok'
  };
}

export function compareBlockSummary(currentBlock = [], previousBlock = []) {
  const comparison = compareBlocks(currentBlock, previousBlock);
  return {
    ...comparison,
    status: 'ok'
  };
}

export function buildToolResultForPrompt(message, activities = []) {
  const lower = message.toLowerCase();

  if (lower.includes('week summary') || lower.includes('weekly summary')) {
    return { tool: 'get_week_summary', result: getWeekSummary(activities) };
  }

  if (lower.includes('session detail') || lower.includes('rep detail')) {
    const target = activities[activities.length - 1];
    return { tool: 'get_session_detail', result: getSessionDetail(target) };
  }

  if (lower.includes('compare block') || lower.includes('block comparison')) {
    const current = activities.slice(-3);
    const previous = activities.slice(-6, -3);
    return { tool: 'compare_blocks', result: compareBlockSummary(current, previous) };
  }

  return null;
}
