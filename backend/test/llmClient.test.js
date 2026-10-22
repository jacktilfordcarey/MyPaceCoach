import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import {
  complete,
  getPreferredProvider,
  parseJsonOutput,
  canUseFallback
} from '../src/services/llmClient.js';

test('getPreferredProvider defaults to anthropic when enabled', () => {
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.LLM_FALLBACK_ENABLED = 'true';

  assert.equal(getPreferredProvider(), 'anthropic');
  assert.equal(canUseFallback(), true);
});

test('parseJsonOutput extracts JSON from model text and validates the schema', () => {
  const schema = z.object({
    status: z.enum(['ok', 'insufficient_data']),
    score: z.number().min(0).max(100)
  });

  const output = '```json\n{"status":"ok","score":82}\n```';
  const parsed = parseJsonOutput(output, schema);

  assert.deepEqual(parsed, { status: 'ok', score: 82 });
});

test('complete rejects missing API config with helpful error', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  await assert.rejects(
    () => complete({
      system: 'system prompt',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 64
    }),
    /Missing API key/i
  );
});
