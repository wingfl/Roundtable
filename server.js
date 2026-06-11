/**
 * 头脑风暴工坊 - 入口
 * 支持双模式：人为主导（人说一句→AI全回→停） / 自动讨论（定时循环→固定轮数上限）
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const configStore = require('./lib/config');
const orchestrator = require('./lib/orchestrator');
const providers = require('./lib/providers');
const defaultPersonas = require('./lib/personas');
const historyStore = require('./lib/history');

const PORT = process.env.PORT || 3456;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// ---- 会话状态 ----
let session = newSession();
let currentHistoryId = null;

function newSession() {
  return {
    topic: '',
    background: '',
    personas: [],
    messages: [],
    mindmap: '',
    status: 'idle',        // idle | ready | brainstorming | converging
    mode: 'human-led',     // human-led | auto
    round: 0,
    maxRounds: 5,
    running: false,
    autoTimer: null
  };
}

function emitSession() {
  io.emit('session_init', {
    topic: session.topic,
    background: session.background,
    personas: session.personas,
    messages: session.messages,
    mindmap: session.mindmap,
    status: session.status,
    mode: session.mode,
    round: session.round,
    maxRounds: session.maxRounds,
    currentHistoryId: currentHistoryId
  });
}

// ---- 配置 API (不变) ----
app.get('/api/config', (req, res) => {
  const cfg = configStore.load();
  res.json({
    providers: cfg.providers.map(p => ({
      ...p,
      apiKey: p.apiKey ? p.apiKey.slice(0, 6) + '...' + p.apiKey.slice(-4) : ''
    })),
    personas: cfg.personas || [],
    personaOverrides: cfg.personaOverrides || {}
  });
});

app.post('/api/config', (req, res) => {
  const newCfg = req.body;
  const oldCfg = configStore.load();
  if (newCfg.providers) {
    newCfg.providers = newCfg.providers.map(np => {
      const op = oldCfg.providers.find(p => p.id === np.id);
      if (op && (!np.apiKey || np.apiKey.includes('...'))) np.apiKey = op.apiKey;
      return np;
    });
  }
  configStore.save(newCfg);
  res.json({ ok: true });
});

app.post('/api/config/apikey', (req, res) => {
  const { providerId, apiKey } = req.body;
  const cfg = configStore.load();
  const p = cfg.providers.find(x => x.id === providerId);
  if (!p) return res.status(404).json({ error: 'not found' });
  p.apiKey = apiKey;
  configStore.save(cfg);
  res.json({ ok: true });
});

app.post('/api/test-connection', async (req, res) => {
  const { providerId } = req.body;
  const cfg = configStore.load();
  const p = cfg.providers.find(x => x.id === providerId);
  if (!p) return res.status(404).json({ error: 'not found' });

  try {
    // 不同供应商类型用不同方式测试（不依赖具体模型名）
    if (p.type === 'openai-compatible' || p.type === 'anthropic') {
      // 先试 /models 接口，不需要模型名
      const modelsUrl = p.type === 'anthropic'
        ? `${p.endpoint}/v1/models`.replace(/\/v1\/v1/, '/v1')
        : `${p.endpoint}/models`;
      const mr = await fetch(modelsUrl, {
        headers: { 'Authorization': `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
      if (mr.ok) {
        const mj = await mr.json().catch(() => ({}));
        const modelList = (mj.data || mj.models || []).slice(0, 3).map(m => m.id || m.name || m).filter(Boolean);
        return res.json({ ok: true, message: `连接成功！可用模型示例: ${modelList.join(', ') || '查看详情'}` });
      }
      // /models 不行的话，用一个通用模型名试 chat
      const fallbackModel = p.type === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-3.5-turbo';
      const testConfig = { ...p, model: fallbackModel };
      const result = await providers.call(testConfig, null, [{ role: 'user', content: '回复"连接成功"' }], {
        maxTokens: 50, temperature: 0, timeout: 30000
      });
      res.json({ ok: true, message: result.trim() });
    } else if (p.type === 'gemini') {
      const testModel = (p.models && p.models[0]) ? p.models[0] : 'gemini-flash-latest';
      const testConfig = { ...p, model: testModel };
      const result = await providers.call(testConfig, null, [{ role: 'user', content: 'Reply "OK"' }], {
        maxTokens: 50, temperature: 0, timeout: 30000
      });
      res.json({ ok: true, message: result.trim() });
    } else {
      throw new Error(`不支持的供应商类型: ${p.type}`);
    }
  } catch (e) {
    console.error('[test-connection] 测试失败:', e.message, e.cause || '');
    res.json({ ok: false, error: e.message });
  }
});

app.get('/api/session', (req, res) => res.json(session));

// ---- 会话初始化 ----
app.post('/api/session/init', (req, res) => {
  const { topic, background, personaIds, maxRounds, mode } = req.body;
  const cfg = configStore.load();
  const all = [...defaultPersonas.map(d => {
    const ov = cfg.personaOverrides?.[d.id];
    if (ov) return { ...d, providerId: 'providerId' in ov ? ov.providerId : d.providerId, model: 'model' in ov ? ov.model : d.model, personality: 'personality' in ov ? ov.personality : d.personality };
    return { ...d };
  }), ...(cfg.personas || []).filter(p => !defaultPersonas.find(d => d.id === p.id))];
  const selected = all.filter(p => personaIds.includes(p.id));

  session = {
    topic,
    background: background || '',
    personas: selected,
    messages: [],
    mindmap: topic ? `# ${topic}\n` : '',
    status: 'ready',
    mode: mode || 'human-led',
    round: 0,
    maxRounds: maxRounds || 5,
    running: false,
    autoTimer: null
  };
  currentHistoryId = null;
  saveHistoryEntry();
  emitSession();
  res.json({ ok: true });
});

// ---- 核心：执行一轮讨论 ----
async function executeRound() {
  if (!session.running) return;
  // 防止并发执行
  if (session.roundRunning) return;
  session.roundRunning = true;

  try {
    session.round++;
    if (session.round > session.maxRounds && session.mode === 'auto') {
      return finishAutoDebate();
    }

    io.emit('round_changed', { round: session.round, maxRounds: session.maxRounds });

    await orchestrator.runRound(session, io);

    if (!session.running) return;

    // 每轮后更新思维导图
    try {
      const md = await orchestrator.updateMindmap(session);
      if (md) {
        session.mindmap = md;
        io.emit('mindmap_updated', { markdown: md });
      }
    } catch (e) {
      console.error('Mindmap update failed:', e.message);
    }

    // 自动模式：马不停蹄继续
    if (session.running && session.mode === 'auto') {
      if (session.round >= session.maxRounds) {
        finishAutoDebate();
      } else {
        scheduleAutoRound();
      }
    }

    // 人为主导模式：此轮结束
    if (session.mode === 'human-led') {
      session.running = false;
      session.status = 'ready';
      io.emit('status_changed', { status: 'ready' });
      orchestrator.emitSystem(io, session, `第 ${session.round} 轮完成。输入你的观点继续讨论。`);
      try { saveHistoryEntry(); } catch (e) {}
    }
  } finally {
    session.roundRunning = false;
  }
}

// ---- 自动讨论控制 ----
function scheduleAutoRound() {
  session.autoTimer = setTimeout(() => executeRound(), 2000);
}

function finishAutoDebate() {
  clearAutoTimer();
  session.status = 'converging';
  session.running = false;

  // 保存历史记录
  if (session.topic && session.messages.length > 0) {
    try {
      saveHistoryEntry();
    } catch (e) { console.error('保存历史记录失败:', e.message); }
  }

  io.emit('status_changed', { status: 'converging' });
  orchestrator.emitSystem(io, session,
    `自动讨论完成，共 ${session.round} 轮。` +
    (session.round >= session.maxRounds ? '已达到轮数上限。' : '') +
    '你可以继续手动发言或再次开启自动讨论。'
  );
}

function clearAutoTimer() {
  if (session.autoTimer) {
    clearTimeout(session.autoTimer);
    session.autoTimer = null;
  }
}

function saveHistoryEntry() {
  const entry = {
    topic: session.topic,
    background: session.background || '',
    mode: session.mode,
    round: session.round,
    maxRounds: session.maxRounds,
    personas: session.personas,
    personaNames: session.personas.map(p => p.name),
    messages: session.messages,
    mindmap: session.mindmap || ''
  };
  if (currentHistoryId) {
    historyStore.update(currentHistoryId, entry);
  } else {
    const rec = historyStore.add(entry);
    currentHistoryId = rec.id;
  }
}

// ---- 脑暴控制 API ----
app.post('/api/brainstorm/start-auto', async (req, res) => {
  if (session.status !== 'ready' && session.status !== 'converging') {
    return res.status(400).json({ error: '状态不允许' });
  }
  if (session.personas.length < 2) return res.status(400).json({ error: '至少2个角色' });

  const noModelAuto = session.personas.filter(p => !p.model);
  if (noModelAuto.length === session.personas.length) {
    return res.status(400).json({ error: '所有角色均未配置模型，请先在全局设置中分配' });
  }
  if (noModelAuto.length > 0) {
    orchestrator.emitSystem(io, session, '⚠️ ' + noModelAuto.map(p => p.name).join('、') + ' 未配置模型，将跳过。');
  }

  session.mode = 'auto';
  session.status = 'brainstorming';
  session.running = true;
  io.emit('status_changed', { status: 'brainstorming', mode: 'auto' });
  orchestrator.emitSystem(io, session, `🤖 自动讨论模式开始，共 ${session.maxRounds} 轮。`);
  res.json({ ok: true });

  executeRound();
});

app.post('/api/brainstorm/start-human-round', async (req, res) => {
  if (session.status !== 'ready' && session.status !== 'converging') {
    return res.status(400).json({ error: '状态不允许' });
  }
  if (session.personas.length < 2) return res.status(400).json({ error: '至少2个角色' });

  const noModelHR = session.personas.filter(p => !p.model);
  if (noModelHR.length === session.personas.length) {
    return res.status(400).json({ error: '所有角色均未配置模型，请先在全局设置中分配' });
  }
  if (noModelHR.length > 0) {
    orchestrator.emitSystem(io, session, '⚠️ ' + noModelHR.map(p => p.name).join('、') + ' 未配置模型，将跳过。');
  }

  session.mode = 'human-led';
  session.status = 'brainstorming';
  session.running = true;
  io.emit('status_changed', { status: 'brainstorming', mode: 'human-led' });
  res.json({ ok: true });

  await executeRound();
});

app.post('/api/brainstorm/stop', (req, res) => {
  clearAutoTimer();
  session.running = false;
  session.status = 'converging';

  // 保存历史记录
  if (session.topic && session.messages.length > 0) {
    try {
      saveHistoryEntry();
    } catch (e) { console.error('保存历史记录失败:', e.message); }
  }

  io.emit('status_changed', { status: 'converging' });
  orchestrator.emitSystem(io, session, '⏹ 讨论已暂停。你可以继续或重新开始。');
  res.json({ ok: true });
});

app.post('/api/brainstorm/resume-auto', (req, res) => {
  if (session.status !== 'converging') return res.status(400).json({ error: '不在收敛状态' });
  if (session.personas.length < 2) return res.status(400).json({ error: '至少2个角色' });

  session.mode = 'auto';
  session.status = 'brainstorming';
  session.running = true;
  io.emit('status_changed', { status: 'brainstorming', mode: 'auto' });
  orchestrator.emitSystem(io, session, `🤖 自动讨论继续，当前第 ${session.round} 轮。`);
  res.json({ ok: true });

  executeRound();
});

app.post('/api/brainstorm/mindmap', async (req, res) => {
  if (session.messages.length === 0) return res.json({ ok: false, error: '无消息' });
  res.json({ ok: true });
  try {
    const md = await orchestrator.updateMindmap(session);
    if (md) {
      session.mindmap = md;
      io.emit('mindmap_updated', { markdown: md });
    }
  } catch (e) {
    io.emit('error', { message: '思维导图生成失败: ' + e.message });
  }
});

// ---- 历史记录 API ----
app.get('/api/history', (req, res) => {
  res.json(historyStore.list());
});

app.get('/api/history/:id', (req, res) => {
  const record = historyStore.get(req.params.id);
  if (!record) return res.status(404).json({ error: 'not found' });
  res.json(record);
});

app.delete('/api/history/:id', (req, res) => {
  historyStore.remove(req.params.id);
  res.json({ ok: true });
});

app.post('/api/history/load/:id', (req, res) => {
  const record = historyStore.get(req.params.id);
  if (!record) return res.status(404).json({ error: 'not found' });
  clearAutoTimer();
  session = {
    topic: record.topic,
    background: record.background || '',
    personas: record.personas || [],
    messages: record.messages || [],
    mindmap: record.mindmap || '',
    status: 'ready',
    mode: record.mode || 'human-led',
    round: record.round || 0,
    maxRounds: record.maxRounds || 5,
    running: false,
    autoTimer: null
  };
  currentHistoryId = req.params.id;
  emitSession();
  res.json({ ok: true });
});

// ---- Socket.IO ----
io.on('connection', (socket) => {
  emitSession();

  // 用户发言（人为主导模式触发一轮）
  socket.on('user_message', async (data) => {
    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      personaId: 'user',
      persona: { id: 'user', name: '你', emoji: '💬', color: '#adb5bd', role: 'host' },
      content: data.content,
      type: 'user',
      timestamp: Date.now()
    };
    session.messages.push(msg);
    // 不 emit new_message，前端已即时渲染

    // 自动模式下用户插入：暂停自动，AI先回复这一条
    if (session.mode === 'auto' && session.running) {
      clearAutoTimer();
      session.mode = 'human-led'; // 临时切回人为主导
      io.emit('status_changed', { status: 'ready', mode: 'human-led' });
      orchestrator.emitSystem(io, session, '💬 用户插入发言，自动讨论已暂停。');
    }

    // 触发一轮AI回复
    if (session.personas.length >= 2) {
      // 检查是否有角色未配置模型
      const noModel = session.personas.filter(p => !p.model);
      if (noModel.length === session.personas.length) {
        orchestrator.emitSystem(io, session, '⚠️ 所有角色都未配置AI模型，请在"全局设置"中为每个角色分配模型。');
        return;
      }
      if (noModel.length > 0) {
        orchestrator.emitSystem(io, session, '⚠️ ' + noModel.map(p => p.name).join('、') + ' 未配置模型，将跳过。');
      }

      session.status = 'brainstorming';
      session.running = true;
      io.emit('status_changed', { status: 'brainstorming', mode: 'human-led' });
      await executeRound();
    }
  });

  // 用户补充事实（不触发AI回复，只更新思维导图上下文）
  socket.on('user_fact', (data) => {
    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      personaId: 'user',
      persona: { id: 'user', name: '你', emoji: '📋', color: '#51cf66', role: 'fact' },
      content: data.content,
      type: 'user_fact',
      timestamp: Date.now()
    };
    session.messages.push(msg);
    // 不 emit new_message，前端已即时渲染

    // 事实补充不自动触发讨论，但更新背景信息提示
    orchestrator.emitSystem(io, session, '📋 事实已记录，下次讨论时AI会参考此信息。');
    try { saveHistoryEntry(); } catch (e) {}
  });

  // 清空会话
  socket.on('reset_session', () => {
    clearAutoTimer();
    session = newSession();
    currentHistoryId = null;
    emitSession();
  });
});

// SPA fallback: serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return;
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`\n🧠 头脑风暴工坊`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   配置: ${configStore.CONFIG_PATH}\n`);
});
