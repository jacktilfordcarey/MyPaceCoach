import fs from 'fs';

const src = fs.readFileSync('./backend/src/services/aiCoach.js', 'utf8');
const stripStart = src.indexOf('function stripFormatting');
const normalizeStart = src.indexOf('function normalizeInsightBullets');
const end = src.indexOf('// Helper function to format pace');

const stripBlock = src.slice(stripStart, normalizeStart);
const normalizeBlock = src.slice(normalizeStart, end);
const normalizeInsightBullets = Function(`${stripBlock}\n${normalizeBlock}\nreturn normalizeInsightBullets;`)();

const sample = [
  '### Coach Insights',
  'Here is the plan:',
  '- We need to produce exactly 4-6 bullet points, each starting with "- ".',
  '- No extra text.',
  '- Each bullet must be a brief coaching insight grounded in the training pattern.',
  '- Must use only actual training details.',
  'bullets:',
  '- The runner has 267.1 km over 32 runs and a weekly average of 62.3 km.',
  '- Consistent training supports steady aerobic development and recovery.',
  '- Long runs help build the endurance base required for sustained effort.'
].join('\n');

const result = normalizeInsightBullets(sample);
console.log(JSON.stringify({
  result,
  containsMeta: /coach insights|we need|must|no extra text|exactly 4-6|bullet points|use only actual training details|no greetings/i.test(result),
  bulletCount: result.split('\n').filter(Boolean).length
}, null, 2));
