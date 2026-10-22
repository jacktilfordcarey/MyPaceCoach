import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.LLM_TIMEOUT_MS || '20000', 10);
const DEFAULT_MAX_RETRIES = Number.parseInt(process.env.LLM_MAX_RETRIES || '3', 10);
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: DEFAULT_TIMEOUT_MS,
      maxRetries: 0
    })
  : null;

const openrouterClient = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      timeout: DEFAULT_TIMEOUT_MS,
      maxRetries: 0
    })
  : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getPreferredProvider() {
  return (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
}

export function canUseFallback() {
  return String(process.env.LLM_FALLBACK_ENABLED ?? 'true').toLowerCase() !== 'false';
}

function getProviderOrder() {
  const primary = getPreferredProvider();
  const providers = [primary];

  if (canUseFallback()) {
    const fallbackProviders = ['anthropic', 'openrouter'];
    for (const provider of fallbackProviders) {
      if (!providers.includes(provider)) {
        providers.push(provider);
      }
    }
  }

  return providers;
}

function normalizeMessages(messages = []) {
  return messages.map((message) => {
    const content = Array.isArray(message.content)
      ? message.content.map((block) => (typeof block === 'string' ? block : block.text || '')).join('\n')
      : String(message.content ?? '');

    return {
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content
    };
  });
}

function safeJsonBlock(input) {
  if (!input || typeof input !== 'string') return null;

  const fencedMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const braceMatch = input.match(/\{[\s\S]*\}/);
  return braceMatch ? braceMatch[0] : null;
}

export function parseJsonOutput(rawOutput, schema) {
  if (!schema) {
    return rawOutput;
  }

  const value = typeof rawOutput === 'string'
    ? JSON.parse(safeJsonBlock(rawOutput) || rawOutput)
    : rawOutput;

  return schema.parse(value);
}

function estimateTokens(provider, result) {
  if (!result || !result.usage) {
    return { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
  }

  const inputTokens = Number(result.usage.input_tokens || result.usage.prompt_tokens || 0);
  const outputTokens = Number(result.usage.output_tokens || result.usage.completion_tokens || 0);

  let estimatedCost = 0;
  if (provider === 'anthropic') {
    estimatedCost = ((inputTokens / 1_000_000) * 3) + ((outputTokens / 1_000_000) * 15);
  }

  return { inputTokens, outputTokens, estimatedCost };
}

function logUsage({ provider, feature, model, result }) {
  const { inputTokens, outputTokens, estimatedCost } = estimateTokens(provider, result);

  console.info('[llmClient]', JSON.stringify({
    provider,
    feature,
    model,
    inputTokens,
    outputTokens,
    estimatedCost: Number(estimatedCost.toFixed(6))
  }));
}

async function callAnthropic({ system, messages, maxTokens, feature }) {
  if (!anthropicClient) {
    const error = new Error('Missing API key: Anthropic is not configured. Set ANTHROPIC_API_KEY to enable the primary provider.');
    error.code = 'missing_api_key';
    throw error;
  }

  const response = await anthropicClient.messages.create({
    model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    max_tokens: maxTokens || 1024,
    system: [{
      type: 'text',
      text: system,
      cache_control: { type: 'ephemeral' }
    }],
    messages: normalizeMessages(messages)
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  logUsage({
    provider: 'anthropic',
    feature,
    model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    result: response
  });

  return {
    content: text,
    provider: 'anthropic',
    model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    raw: response
  };
}

async function callOpenRouter({ system, messages, maxTokens, feature }) {
  if (!openrouterClient) {
    const error = new Error('Missing API key: OpenRouter is not configured. Set OPENROUTER_API_KEY to use the fallback provider.');
    error.code = 'missing_api_key';
    throw error;
  }

  const response = await openrouterClient.chat.completions.create({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free',
    max_tokens: maxTokens || 1024,
    messages: [
      { role: 'system', content: system },
      ...normalizeMessages(messages)
    ]
  });

  const content = response.choices?.[0]?.message?.content || '';

  logUsage({
    provider: 'openrouter',
    feature,
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free',
    result: response
  });

  return {
    content,
    provider: 'openrouter',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free',
    raw: response
  };
}

async function callWithRetry(provider, requestConfig, options = {}) {
  const retries = Number.parseInt(options.retries ?? String(DEFAULT_MAX_RETRIES), 10);
  let lastError;

  const providerCall = provider === 'anthropic' ? callAnthropic : provider === 'openrouter' ? callOpenRouter : null;
  if (!providerCall) {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  try {
    return await providerCall(requestConfig);
  } catch (error) {
    if (error.code === 'missing_api_key') {
      throw error;
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await providerCall(requestConfig);
      } catch (retryError) {
        lastError = retryError;
        if (attempt >= retries) {
          throw retryError;
        }

        const backoffMs = Math.min(1000 * (2 ** attempt), 8000);
        console.warn(`[llmClient] ${provider} request failed (${attempt + 1}/${retries + 1}), retrying in ${backoffMs}ms`, retryError.message);
        await sleep(backoffMs);
      }
    }
  }

  throw lastError;
}

export async function complete({
  system,
  messages = [],
  schema,
  maxTokens = 1024,
  feature = 'unknown'
}) {
  if (!system) {
    throw new Error('LLM completion requires a system prompt.');
  }

  const providerOrder = getProviderOrder();
  let lastError;

  for (const provider of providerOrder) {
    try {
      const response = await callWithRetry(provider, { system, messages, maxTokens, feature }, { retries: DEFAULT_MAX_RETRIES });

      if (schema) {
        return parseJsonOutput(response.content, schema);
      }

      return response.content;
    } catch (error) {
      lastError = error;
      console.warn(`[llmClient] provider ${provider} failed for feature ${feature}:`, error.message);

      if (error.code === 'missing_api_key') {
        continue;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('No LLM provider was available for this request.');
}
