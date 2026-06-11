// Google Gemini (免费 API: https://aistudio.google.com)
// 代理配置：默认读取 HTTPS_PROXY 环境变量，否则走直连
let proxyAgent = null;
try {
  const { ProxyAgent } = require('undici');
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || 'http://127.0.0.1:7897';
  proxyAgent = new ProxyAgent(proxyUrl);
} catch (_) { /* undici 未安装则走直连 */ }

async function call(config, messages, opts = {}) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  // Gemini 要求 user/model 交替，不能有连续相同 role
  const contents = [];
  for (let i = 0; i < chatMsgs.length; i++) {
    const msg = chatMsgs[i];
    const role = msg.role === 'assistant' ? 'model' : 'user';
    // 如果上一个消息角色相同，插入一个空的 user 消息
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents.push({ role: role === 'user' ? 'model' : 'user', parts: [{ text: '.' }] });
    }
    contents.push({ role, parts: [{ text: msg.content }] });
  }

  const body = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.8,
      maxOutputTokens: opts.maxTokens ?? 2048
    }
  };

  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const url = `${config.endpoint}/models/${encodeURIComponent(config.model)}:generateContent`;
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': config.apiKey
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeout || 60000)
  };
  // 通过代理连接 Google API（解决中国网络环境直连超时问题）
  if (proxyAgent) fetchOptions.dispatcher = proxyAgent;

  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[Gemini] ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error(`[Gemini] 响应格式异常: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const candidate = data.candidates[0];
  const parts = candidate.content.parts;
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    console.warn(`[Gemini] finishReason=${candidate.finishReason}, 输出可能被截断`);
  }
  if (!parts || parts.length === 0) {
    const reason = candidate.finishReason || 'unknown';
    throw new Error(`[Gemini] 无回复内容 (finishReason: ${reason})`);
  }
  return parts.map(p => p.text).join('');
}

module.exports = { call, type: 'gemini' };
