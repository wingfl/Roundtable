// OpenAI 兼容供应商 (OpenAI / DeepSeek / Groq / Qwen / vLLM / OpenRouter ...)
async function call(config, messages, opts = {}) {
  const res = await fetch(`${config.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 2048
    }),
    signal: AbortSignal.timeout(opts.timeout || 60000)
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[OpenAI] ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error(`[OpenAI] 响应格式异常: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.choices[0].message.content;
}

module.exports = { call, type: 'openai-compatible' };
