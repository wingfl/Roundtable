// 供应商注册表

const providers = {
  'openai-compatible': require('./openai'),
  'anthropic': require('./anthropic'),
  'gemini': require('./gemini')
};

/**
 * 调用指定供应商
 * @param {object} config - 供应商配置 { type, endpoint, apiKey, model }
 * @param {object} persona - 可选，当前角色信息（用于错误提示）
 * @param {array} messages - 消息列表 [{ role, content }]
 * @param {object} opts - { temperature, maxTokens, timeout }
 * @returns {string} AI回复文本
 */
async function call(config, persona, messages, opts = {}) {
  const provider = providers[config.type];
  if (!provider) throw new Error(`不支持的供应商类型: ${config.type}`);

  try {
    return await provider.call(config, messages, opts);
  } catch (e) {
    // 在错误信息前加上角色名，方便定位
    const who = persona ? `[${persona.name}] ` : '';
    e.message = who + e.message;
    throw e;
  }
}

/** 获取所有支持的供应商类型 */
function list() {
  return Object.values(providers).map(p => p.type);
}

module.exports = { call, list };
