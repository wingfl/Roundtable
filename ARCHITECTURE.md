# 技术架构文档

> 头脑风暴工坊 — 设计决策、数据流、状态机与扩展指南

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  浏览器 (React SPA)                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ ChatPanel │  │ Mindmap  │  │ History  │              │
│  │           │  │ Panel    │  │ Sidebar  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                     │
│  ┌────┴─────────────┴─────────────┴────┐                │
│  │   useSession (全局状态 + Reducer)    │                │
│  └────────────────┬───────────────────┘                │
│                   │                                     │
│  ┌────────────────┴───────────────────┐                │
│  │  useSocket (Socket.IO Client)      │                │
│  └────────────────┬───────────────────┘                │
└───────────────────┼─────────────────────────────────────┘
                    │ Socket.IO + REST API
┌───────────────────┼─────────────────────────────────────┐
│  Express + Socket.IO 服务器                              │
│  ┌────────────────┴───────────────────┐                │
│  │  server.js (session 管理 + API)    │                │
│  └────────┬───────────────┬───────────┘                │
│           │               │                             │
│  ┌────────┴──────┐ ┌──────┴──────────┐                 │
│  │ orchestrator  │ │ providers/      │                 │
│  │ (辩论编排)    │ │ (AI 适配层)     │                 │
│  └───────────────┘ └──────┬──────────┘                 │
│                           │                             │
│              ┌────────────┼────────────┐               │
│              │            │            │               │
│         OpenAI      Anthropic      Gemini              │
└─────────────────────────────────────────────────────────┘
```

### 设计决策：为什么选 Socket.IO 而非纯 REST

| 需求 | Socket.IO 方案 | 纯 REST 方案 |
|---|---|---|
| 实时推送消息 | 原生的 `emit`，服务端直接推 | 需要轮询或 SSE |
| 多角色并发发言 | `thinking` 事件逐角色推送 loading 状态 | 不支持 |
| 思维导图实时更新 | `mindmap_updated` 推送 | 需要轮询 |
| 会话状态同步 | `session_init` 全量同步 | 需要多次 GET |
| 断线重连 | Socket.IO 内置 | 需要手动实现 |

---

## 2. 会话状态机

```
         initSession
  idle ────────────────► ready
                           │
          startAuto /       │ user_message
          startHumanRound   │
                           ▼
                     brainstorming ◄────────────────┐
                           │                        │
               ┌───────────┼──────────┐             │
               │           │          │             │
        auto完成     human-led轮    stop            │
        达到maxRounds 完成1轮                      │
               │           │          │             │
               ▼           ▼          ▼             │
             converging ◄──────────────┘            │
               │                                    │
               │ resumeAuto                         │
               └────────────────────────────────────┘
```

**状态定义：**

| 状态 | 含义 | 允许操作 |
|---|---|---|
| `idle` | 未初始化 | initSession |
| `ready` | 已初始化，等待触发 | startAuto / startHumanRound / user_message |
| `brainstorming` | 讨论进行中 | stop / user_message |
| `converging` | 讨论暂停/完成 | resumeAuto / startHumanRound / user_message |

**辅助标志：**
- `session.running` — 是否正在执行中（防止并发）
- `session.roundRunning` — 当前是否有一轮正在执行（防止 `executeRound` 重入）

---

## 3. 数据流详解

### 3.1 人为主导模式 (Human-Led)

```
用户输入观点
  │
  ├─► 前端即时渲染 user message（体验优化：不等服务端）
  ├─► emit("user_message", { content })
  │
  ▼
服务端:
  ├─► messages.push(user msg)
  ├─► 如果在 auto 模式下，暂停 auto 切回 human-led
  ├─► executeRound()
  │     ├─► orchestrator.runRound()
  │     │     ├─► 各 persona 并发调用 AI
  │     │     ├─► emit("thinking") 逐角色
  │     │     └─► emit("new_message") 逐角色
  │     ├─► orchestrator.updateMindmap()
  │     │     └─► emit("mindmap_updated")
  │     └─► saveHistoryEntry()  ← 每轮 human-led 后持久化
  │
  ▼
前端:
  ├─► on("new_message") → dispatch NEW_MESSAGE
  ├─► on("mindmap_updated") → dispatch MINDMAP_UPDATED
  └─► ChatPanel 自动滚动到底部
```

### 3.2 自动讨论模式 (Auto)

```
startAuto API
  │
  ▼
executeRound() 循环:
  ├─► round++ → check maxRounds
  ├─► runRound() → AI 发言
  ├─► updateMindmap()
  └─► scheduleAutoRound() → setTimeout(2000ms) 后再次 executeRound()
        │
        └─► 直到 round >= maxRounds → finishAutoDebate()
```

### 3.3 历史记录加载

```
点击历史条目
  │
  ▼
POST /api/history/load/:id
  ├─► historyStore.get(id)
  ├─► 覆盖 server.js session 对象
  ├─► currentHistoryId = id
  ├─► emitSession()
  │
  ▼
前端收到 session_init → dispatch SESSION_INIT → 全量替换状态
  │
  ▼
后续任何新消息 → saveHistoryEntry() → update(id, ...)
  （currentHistoryId 不为 null，走 update 而非 add）
```

### 3.4 会话初始化

```
POST /api/session/init
  │
  ├─► 取 defaultPersonas (lib/personas.js)
  ├─► 应用 personaOverrides (config.json) — 只覆盖 providerId/model
  ├─► 合并用户自定义 personas
  ├─► 筛选选中的角色
  ├─► 创建新 session 对象
  ├─► saveHistoryEntry() → add() → currentHistoryId
  └─► emitSession()
```

---

## 4. AI 上下文构建策略

### 核心原则

**每个 AI 只能看到：**
1. 自己的角色设定（personality）
2. 话题和背景信息
3. **思维导图**（全量讨论的结构化压缩，不是原始消息堆栈）
4. 上一轮其他人的发言（纯文本，不含角色设定）

**每个 AI 绝不能看到：**
- 其他 AI 的角色设定
- 历史原始消息的全量堆栈
- 自己的上一轮发言（减少重复）

### 为什么用思维导图而非全量历史

| 方案 | Token 消耗 | 信息密度 | 丢失风险 |
|---|---|---|---|
| 全量历史消息 | O(n) 线性增长 | 低（有很多废话） | 无 |
| 思维导图（增量摘要） | 恒定 | 高 | 摘要遗漏导致的不可逆丢失 |

当前选择思维导图方案，每轮对话量固定，适合多轮深度讨论。代价是如果某轮摘要遗漏了关键信息，之后无法补回。

###上下文构建代码路径

```
orchestrator.buildContext(persona, session)
  │
  ├─► system: 你是 XX，XX 角色。{personality}
  │            话题："{topic}"
  │            背景：{background}
  │            思维导图：{mindmap}
  │            规则：禁止自我介绍/寒暄/Markdown
  │
  └─► user: 上一轮其他人的发言：{name}：{content}\n\n...
             现在轮到你发言。直接说你的观点，不要自我介绍或寒暄。
```

---

## 5. 前端架构

### 5.1 组件树

```
App
├── ThemeProvider        ← 主题上下文（dark/light/system）
│   ├── TooltipProvider  ← shadcn/ui tooltip
│   │   ├── ToastProvider
│   │   │   ├── SessionProvider  ← 全局状态
│   │   │   │   └── AppContent
│   │   │   │       ├── TopBar（设置、新建会话、历史切换）
│   │   │   │       ├── HistorySidebar（可拖拽宽度）
│   │   │   │       │   └── ResizeHandle
│   │   │   │       ├── ChatPanel（flex-1，自动伸缩）
│   │   │   │       │   ├── 模式切换 (opinion/fact)
│   │   │   │       │   ├── 消息列表 (MessageBubble × N)
│   │   │   │       │   └── 输入区 (Textarea + Send)
│   │   │   │       ├── ResizeHandle
│   │   │   │       ├── MindmapPanel（可拖拽宽度）
│   │   │   │       ├── SettingsModal（全局设置）
│   │   │   │       └── SetupModal（新建会话）
```

### 5.2 状态管理 (useReducer)

```
initialState = {
  topic, background, personas[], messages[], mindmap,
  status, mode, round, maxRounds,
  thinking{},         // { [personaId]: "thinking" } — 哪个角色正在思考
  factCounter, allFacts[],
  config{ providers[], personas[], personaOverrides{} },
  historyList[], currentHistoryId,
}
```

**Reducer Actions:**

| Action | 触发源 | 效果 |
|---|---|---|
| `SESSION_INIT` | socket `session_init` | 全量替换会话状态 |
| `NEW_MESSAGE` | socket `new_message` | 追加一条消息 |
| `STATUS_CHANGED` | socket `status_changed` | 更新 status/mode |
| `ROUND_CHANGED` | socket `round_changed` | 更新轮数 |
| `MINDMAP_UPDATED` | socket `mindmap_updated` | 更新思维导图 |
| `THINKING_START/DONE/ERROR` | socket `thinking` | 控制 thinking 动画 |
| `SET_CONFIG` | API 加载配置 | 更新配置 |
| `SET_HISTORY` | API 加载历史列表 | 更新历史列表 |
| `RESET` | 用户点击删除当前会话 | 回到首页 |
| `SET_MINDMAP` | 手动触发 | 更新思维导图 |

### 5.3 ResizeHandle（面板拖拽）

实现策略：**拖拽期间绕开 React，用原生 DOM 操作；mouseup 才同步回 state**。

```
mousedown → 记录 startX, startW, 设置 transition:none
mousemove → el.style.width = newW（不触发 React render）
mouseup   → onResize(finalW) → setState → 恢复 transition
```

方向参数：
- `direction="left"` → 拖拽左侧面板的右边界（HistorySidebar）
- `direction="right"` → 拖拽 ChatPanel 和 MindmapPanel 之间的边界

宽度限制：160px ~ 500px

---

## 6. Socket.IO 事件协议

### 服务端 → 客户端

| 事件 | Payload | 说明 |
|---|---|---|
| `session_init` | `{ topic, background, personas[], messages[], mindmap, status, mode, round, maxRounds, currentHistoryId }` | 首次连接或会话重置时全量同步 |
| `new_message` | `{ id, personaId, persona, content, type, round, timestamp }` | 单条新消息 |
| `thinking` | `{ personaId, status: "start"\|"done"\|"error" }` | 角色思考状态 |
| `status_changed` | `{ status, mode? }` | 会话状态变更 |
| `round_changed` | `{ round, maxRounds }` | 轮数变更 |
| `mindmap_updated` | `{ markdown }` | 思维导图更新 |

### 客户端 → 服务端

| 事件 | Payload | 说明 |
|---|---|---|
| `user_message` | `{ content }` | 用户发言（观点），触发 AI 回复 |
| `user_fact` | `{ content }` | 用户补充事实，不触发 AI |
| `reset_session` | — | 清空会话 |

---

## 7. AI 供应商扩展

### 新增供应商只需两步

**第一步：** 创建 `lib/providers/new-provider.js`
```js
async function call(config, messages, opts = {}) {
  // config: { type, endpoint, apiKey, model }
  // messages: [{ role, content }]
  // opts: { temperature, maxTokens, timeout }
  const res = await fetch(`${config.endpoint}/chat`, { ... });
  const data = await res.json();
  return data.response; // 返回纯文本
}

module.exports = { call, type: 'new-provider' };
```

**第二步：** 在 `lib/providers/index.js` 注册
```js
const providers = {
  'openai-compatible': require('./openai'),
  'anthropic': require('./anthropic'),
  'gemini': require('./gemini'),
  'new-provider': require('./new-provider'),  // ← 添加这一行
};
```

前端配置面板的供应商类型下拉框也需要添加新选项（`client/src/components/settings/settings-modal.jsx`），连接测试逻辑在 `server.js` → `POST /api/test-connection`。

---

## 8. 持久化策略

| 数据 | 存储方式 | 时机 | 备注 |
|---|---|---|---|
| 配置（供应商、角色覆盖） | `config.json` | 用户保存时 | API Key 脱敏返回前端，写入时合并已有 key |
| 历史记录 | `history.json`（JSON 数组） | initSession / human-led轮次完成 / auto完成 / stop / user_fact | 最大 100 条，新纪录 unshift |
| 历史记录更新 | `history.json` | 同一 `currentHistoryId` 的后续消息 | `update(id, entry)` 原地更新 |
| 当前会话状态 | **内存**（不持久化） | — | 服务重启丢失 |

**注意：** 当前会话只在调用 `saveHistoryEntry()` 时才写入 `history.json`。如果用户在讨论中关闭浏览器未触发 stop，当前轮次的消息不会持久化。

---

## 9. 安全注意事项

- **API Key 存储**: `config.json` 明文存储，无加密。HTTP 接口无鉴权。仅适合本地/localhost 使用。
- **API Key 脱敏**: 前端 GET `/api/config` 返回 `sk-xxx...xxxx` 格式，原 key 仅后端持有
- **CORS**: `origin: '*'`，仅限本地开发

---

## 10. 性能考虑

| 优化点 | 实现 |
|---|---|
| AI 调用并发 | `Promise.all(tasks)` 同时请求所有角色 |
| 思维导图增量更新 | 仅传最新一轮 + 上一版思维导图，非全量历史 |
| 拖拽性能 | 使用原生 DOM 操作，脱离 React render 循环 |
| 前端消息列表 | 不做虚拟滚动（消息量小，最多几百条） |
| 历史记录上限 | 100 条，`history.json` 大小控制在数 MB |
