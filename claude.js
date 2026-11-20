const MODEL = 'claude-haiku-4-5';
const MESSAGES = 'https://api.anthropic.com/v1/messages';

export async function getStructuredAnswer({ key, schema, system, input, request, maxTokens = 650 }) {
  let response;
  try {
    response = await request(MESSAGES, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'x-api-key': key,
      },
      signal: AbortSignal.timeout(24000),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: JSON.stringify(input) }],
        tools: [{ name: 'record_result', description: 'Return the requested structured result.', input_schema: schema }],
        tool_choice: { type: 'tool', name: 'record_result', disable_parallel_tool_use: true },
      }),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('Claude took too long to respond. Try again.');
    throw new Error('Could not reach Claude. Check your connection and try again.');
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const body = await response.json().catch(() => null);
      if (/cors requests are not allowed/i.test(body?.error?.message || '')) {
        throw new Error('Your Anthropic organization blocks Claude requests from browser extensions.');
      }
      throw new Error('Claude rejected this API key. Check the key in settings.');
    }
    if (response.status === 429) throw new Error('Claude’s rate limit was reached. Try again shortly.');
    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      if (/credit balance/i.test(body?.error?.message || '')) {
        throw new Error('The Anthropic account needs API credits.');
      }
    }
    throw new Error(`Claude returned HTTP ${response.status}. Try again or check your API access.`);
  }
  const body = await response.json();
  const output = body.content?.find((item) => item.type === 'tool_use' && item.name === 'record_result')?.input;
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new Error('Claude returned an incomplete answer. Try again.');
  }
  return output;
}
