const providers = require('./providers');
const configStore = require('./config');

/**
 * 构建某个角色的对话上下文
 * 每个AI只拿到：自己的角色设定 + 背景信息 + 思维导图（压缩上下文） + 上一轮其他人的发言文本
 * 绝不发送：其他AI的角色设定、历史原始消息堆栈
 */
function buildContext(persona, session) {
  const systemLines = [
    `你是${persona.emoji} ${persona.name}，${persona.role}。`,
    persona.personality,
    '',
    `当前讨论话题："${session.topic}"`,
  ];

  // 背景信息
  if (session.background) {
    systemLines.push('', '背景：', session.background);
  }

  // 思维导图 = 压缩后的讨论全貌
  systemLines.push(
    '',
    '思维导图（讨论的结构化总结）：',
    session.mindmap || `# ${session.topic}（刚开始）`,
    '',
    '规则：',
    '1. 直接发表专业观点，开门见山——禁止自我介绍、禁止寒暄感谢（如"感谢各位""大家好"）、禁止用 Markdown 格式标记（如 **[粗体]**、[标签]）',
    '2. 阅读思维导图了解全貌，不重复已有共识',
    '3. 对已有观点进行回应、补充、质疑或提出新角度',
    '4. 观点具体可执行，避免抽象空话',
    '5. 用中文'
  );

  const systemPrompt = systemLines.join('\n');

  const messages = [{ role: 'system', content: systemPrompt }];

  // 只拿最近一轮其他人的发言（不含角色设定）
  const msgWithRound = session.messages.filter(m => m.round > 0 && m.type === 'message');
  const maxRound = msgWithRound.length > 0 ? Math.max(...msgWithRound.map(m => m.round)) : 0;

  if (maxRound > 0) {
    const latestOthers = session.messages.filter(
      m => m.round === maxRound && m.type === 'message' && m.personaId !== persona.id
    );

    if (latestOthers.length > 0) {
      const othersSpeak = latestOthers
        .map(m => `${m.persona.name}：${m.content}`)
        .join('\n\n');
      messages.push({
        role: 'user',
        content: `上一轮其他人的发言：\n\n${othersSpeak}\n\n现在轮到你发言。直接说出你的观点，不要自我介绍或寒暄。`
      });
    } else {
      messages.push({
        role: 'user',
        content: `请针对话题"${session.topic}"发表你的专业观点。直接说，不要寒暄。`
      });
    }
  } else {
    // 第一轮
    messages.push({
      role: 'user',
      content: `针对话题"${session.topic}"，说说你的专业分析与观点。直接说，不要自我介绍。${session.background ? '请结合背景信息。' : ''}`
    });
  }

  return messages;
}

/**
 * 执行一轮讨论：所有角色同时发言
 */
async function runRound(session, io) {
  const cfg = configStore.load();

  const tasks = session.personas.map(async (persona) => {
    const providerCfg = cfg.providers.find(p => p.id === persona.providerId);
    if (!providerCfg) {
      emitError(io, session, persona, `未配置AI供应商 "${persona.providerId}"`);
      return;
    }

    io.emit('thinking', { personaId: persona.id, status: 'start' });

    try {
      const messages = buildContext(persona, session);
      const mergedCfg = { ...providerCfg, model: persona.model };
      const response = await providers.call(mergedCfg, persona, messages, {
        temperature: 0.9,
        maxTokens: 4096
      });

      const msg = createMessage(persona, response, session.round);
      session.messages.push(msg);
      io.emit('thinking', { personaId: persona.id, status: 'done' });
      io.emit('new_message', msg);
    } catch (e) {
      io.emit('thinking', { personaId: persona.id, status: 'error' });
      const errMsg = {
        id: 'err_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        personaId: persona.id,
        persona: { id: persona.id, name: persona.name, emoji: persona.emoji, color: persona.color, role: persona.role },
        content: e.message,
        type: 'persona_error',
        timestamp: Date.now(),
        round: session.round
      };
      session.messages.push(errMsg);
      io.emit('new_message', errMsg);
    }
  });

  await Promise.all(tasks);
}

/**
 * 增量更新思维导图：基于上一版思维导图 + 最新一轮讨论
 */
async function updateMindmap(session) {
  const cfg = configStore.load();
  if (session.personas.length === 0) {
    console.log('[mindmap] 无角色，跳过');
    return null;
  }

  // 优先使用专用思维导图模型配置
  let providerCfg = null;
  let model = null;
  
  if (cfg.mindmapProvider && cfg.mindmapProvider.providerId && cfg.mindmapProvider.model) {
    providerCfg = cfg.providers.find(p => p.id === cfg.mindmapProvider.providerId);
    model = cfg.mindmapProvider.model;
    console.log('[mindmap] 使用专用配置: ' + providerCfg?.name + ' / ' + model);
  }
  
  // 如果没有专用配置，使用第一个角色的模型
  if (!providerCfg) {
    const persona = session.personas[0];
    providerCfg = cfg.providers.find(p => p.id === persona.providerId);
    model = persona.model;
    console.log('[mindmap] 使用默认配置（第一个角色）: ' + providerCfg?.name + ' / ' + model);
  }
  
  if (!providerCfg) {
    console.log('[mindmap] 未找到供应商配置');
    return null;
  }

  if (!model) {
    console.log('[mindmap] 未配置模型');
    return null;
  }

  // 取最新一轮的讨论消息（包含 message 和 user 类型，排除 system/error/persona_error）
  const currentRound = session.round;
  let latestMsgs = session.messages.filter(
    m => m.round === currentRound && (m.type === 'message' || m.type === 'user')
  );

  // 兜底：当前轮无有效消息时，取上一轮的消息
  if (latestMsgs.length === 0) {
    const prevRound = currentRound - 1;
    if (prevRound > 0) {
      latestMsgs = session.messages.filter(
        m => m.round === prevRound && (m.type === 'message' || m.type === 'user')
      );
      console.log('[mindmap] 第' + currentRound + '轮无消息，回退到第' + prevRound + '轮, 找到 ' + latestMsgs.length + ' 条');
    }
  }

  // 再兜底：取所有轮次的消息
  if (latestMsgs.length === 0) {
    latestMsgs = session.messages.filter(
      m => m.round > 0 && (m.type === 'message' || m.type === 'user')
    );
    console.log('[mindmap] 回退后仍无消息，取所有轮次, 找到 ' + latestMsgs.length + ' 条');
  }

  if (latestMsgs.length === 0) {
    console.log('[mindmap] 无有效讨论消息, messages总数=' + session.messages.length + ', rounds=' + [...new Set(session.messages.map(m => m.round))].join(','));
    return session.mindmap || null;
  }

  const newDiscussion = latestMsgs
    .map(m => `${m.persona.name}：${m.content}`)
    .join('\n\n');

  const prevMindmap = session.mindmap || `# ${session.topic}`;

  const prompt = [
    {
      role: 'system',
      content: [
        '你是思维导图生成器。根据已有思维导图和最新一轮讨论，增量更新思维导图。',
        '',
        '输出要求：',
        '- 用 # 表示主题',
        '- 用 ## 表示主要类别（如：共识、分歧、关键洞察、待探索）',
        '- 用 ### 表示具体观点',
        '- 用 #### 表示细节',
        '- 只输出 Markdown，不要任何解释',
        '- 保留历史思维导图中仍然有效的部分，更新/新增变化的部分',
        '- 如果某条共识或分歧已被推翻，移除或标记'
      ].join('\n')
    },
    {
      role: 'user',
      content: `已有思维导图：\n${prevMindmap}\n\n最新一轮讨论（第${currentRound}轮）：\n${newDiscussion}\n\n请增量更新思维导图：`
    }
  ];

  try {
    const result = await providers.call({ ...providerCfg, model: model }, null, prompt, {
      temperature: 0.3,
      maxTokens: 2048
    });
    if (result && result.trim().startsWith('#')) {
      return result;
    }
    console.log('[mindmap] AI 返回无效内容: ' + (result ? result.slice(0, 100) : 'null'));
    // fall through to fallback
  } catch (e) {
    console.error('Mindmap AI call failed:', e.message);
    // fall through to fallback
  }

  // 兜底：用本地简单规则生成基本结构，确保用户总能看到思维导图
  const fallback = buildFallbackMindmap(session, latestMsgs);
  if (fallback) {
    console.log('[mindmap] 使用兜底生成, 长度=' + fallback.length);
    return fallback;
  }
  return null;
}

/**
 * 兜底思维导图生成：不依赖 AI，直接用消息内容构造简单结构
 */
function buildFallbackMindmap(session, latestMsgs) {
  const topic = session.topic || '话题';
  const personas = session.personas;
  const allMsgs = session.messages.filter(
    m => m.round > 0 && (m.type === 'message' || m.type === 'user')
  );

  if (allMsgs.length === 0) {
    return session.mindmap || `# ${topic}\n`;
  }

  const lines = [`# ${topic}`];
  
  // 按角色分组观点
  const byPersona = {};
  for (const m of allMsgs) {
    const key = m.personaId;
    if (!byPersona[key]) byPersona[key] = [];
    byPersona[key].push(m);
  }

  lines.push('', '## 各方观点');
  for (const [pid, msgs] of Object.entries(byPersona)) {
    const p = personas.find(pp => pp.id === pid) || { name: pid, emoji: '' };
    const latest = msgs[msgs.length - 1];
    // 取每条消息的第一句话作为摘要（截断40字）
    const snippet = latest.content.replace(/\n/g, ' ').slice(0, 80);
    lines.push(`- ${p.emoji || ''} ${p.name}：${snippet}${snippet.length >= 80 ? '...' : ''}`);
  }

  // 简单共识检测：所有角色都提到的关键词
  if (allMsgs.length >= 2) {
    const allContent = allMsgs.map(m => m.content.toLowerCase());
    const commonWords = ['建议', '需要', '可以', '应该', '重要', '关键', '核心'];
    const found = commonWords.filter(w => allContent.every(c => c.includes(w)));
    if (found.length > 0) {
      lines.push('', '## 可能的共识');
      lines.push('- 多位角色共同关注的核心方向');
    }
  }

  lines.push('', '## 待深入讨论');
  lines.push('- 本话题还需要更多轮对话来深化');

  return lines.join('\n') + '\n';
}

function createMessage(persona, content, round) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    personaId: persona.id,
    persona: {
      id: persona.id, name: persona.name, role: persona.role,
      color: persona.color, emoji: persona.emoji
    },
    content,
    type: 'message',
    round,
    timestamp: Date.now()
  };
}

function emitError(io, session, persona, content) {
  const msg = {
    id: Date.now().toString(36),
    personaId: persona.id,
    persona: { id: persona.id, name: persona.name, role: persona.role, color: persona.color, emoji: persona.emoji },
    content, type: 'error', timestamp: Date.now()
  };
  session.messages.push(msg);
  io.emit('new_message', msg);
}

function emitSystem(io, session, content) {
  const msg = {
    id: Date.now().toString(36),
    personaId: null, persona: null,
    content, type: 'system', timestamp: Date.now()
  };
  session.messages.push(msg);
  io.emit('new_message', msg);
}

module.exports = { buildContext, runRound, updateMindmap, emitSystem, emitError };
