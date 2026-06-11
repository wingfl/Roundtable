// Anthropic Claude
async function call(config, messages, opts = {}) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  const body = {
    model: config.model,
    max_tokens: opts.maxTokens ?? 2048,
    messages: chatMsgs.map(m => ({ role: m.role, content: m.content }))
  };

  if (systemMsg) {
    body.system = [{ type: 'text', text: systemMsg.content }];
  }

  const res = await fetch(`${config.endpoint}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeout || 60000)
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[Anthropic] ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.content || !data.content[0]) {
    throw new Error(`[Anthropic] 响应格式异常`);
  }
  return data.content[0].text;
}

module.exports = { call, type: 'anthropic' };
