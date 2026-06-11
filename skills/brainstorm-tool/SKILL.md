---
agent_created: true
name: brainstorm-tool
description: 头脑风暴工坊项目的上下文技能。当 AI 需要修改/理解/运行 brainstorm-tool 项目时使用。
---

# 头脑风暴工坊 (Brainstorm Tool) — 项目技能

## 项目概览

多 AI 角色对抗式头脑风暴工具。5 个预设角色（魔鬼代言人、远见者、落地者、用户之声、哲人）通过不同的大模型供应商进行观点碰撞和讨论。

## 技术栈

| 层 | 技术 | 关键文件 |
|---|---|---|
| 前端 | React 19 + Vite + Tailwind 3 + shadcn/ui | `client/src/` |
| 后端 | Express + Socket.IO | `server.js` |
| AI 适配 | OpenAI 兼容 / Anthropic / Gemini | `lib/providers/` |
| 状态管理 | useReducer + Socket.IO | `client/src/hooks/use-session.jsx` |
| 可视化 | markmap | `client/src/components/mindmap/` |

## 项目结构（核心文件）

```
brainstorm-tool/
├── server.js                     # Express + Socket.IO 入口，会话管理，历史 API
├── config.json                   # 用户配置（供应商、角色覆盖）— .gitignore 排除，不上传仓库
├── config.example.json           # 配置模板（占位符 API Key）— 提交到仓库，新用户复制后填写
├── history.json                  # 历史记录持久化
├── package.json                  # 后端依赖
├── lib/
│   ├── personas.js               # 【核心】5 个预设角色的详细人格设定
│   ├── orchestrator.js           # 【核心】辩论编排：上下文构建、发言控制、思维导图生成
│   ├── history.js                # 历史记录 CRUD（JSON 文件存储）
│   ├── config.js                 # 配置文件读写
│   └── providers/
│       ├── index.js              # 供应商注册与路由
│       ├── openai.js             # OpenAI 兼容协议
│       ├── anthropic.js          # Anthropic Claude
│       └── gemini.js             # Google Gemini
├── client/
│   ├── package.json              # 前端依赖
│   ├── vite.config.js            # Vite 配置（dev proxy → 3456）
│   ├── index.html                # HTML 入口
│   ├── src/
│   │   ├── App.jsx               # 根组件：Provider 嵌套 + ResizeHandle + 布局
│   │   ├── index.css             # Tailwind + markmap 深色模式覆盖 + CSS 变量
│   │   ├── hooks/
│   │   │   ├── use-session.jsx   # 【核心】全局状态（useReducer + Socket 事件 → dispatch）
│   │   │   ├── use-socket.js     # Socket.IO 客户端封装
│   │   │   ├── use-theme.jsx     # 主题管理（浅色/深色/系统）
│   │   │   └── use-toast.jsx     # Toast 通知
│   │   ├── services/
│   │   │   └── api.js            # REST API 封装
│   │   └── components/
│   │       ├── ui/               # shadcn/ui 组件库
│   │       ├── chat/             # ChatPanel（聊天区 + 输入区）+ MessageBubble
│   │       ├── mindmap/          # MindmapPanel（markmap 渲染）
│   │       ├── history/          # HistorySidebar
│   │       ├── settings/         # SettingsModal（全局设置）+ SetupModal（新建会话）
│   │       └── layout/           # TopBar + ThemeToggle
│   └── dist/                     # Vite 构建产物（被 server.js 静态服务）
└── .workbuddy/skills/            # 本文件所在目录
```

## 配置管理（API Key 安全）

`config.json` 在 `.gitignore` 中，**不会上传到仓库**。仓库提供 `config.example.json` 作为模板（含占位符 `YOUR_API_KEY`）。

**新用户/新 AI 的初始化：**
1. 检查 `config.json` 是否存在
2. 若不存在 → 提示用户复制 `config.example.json` → `config.json` 并填入 API Key
3. 若存在直接加载

**修改 config.json 后无需手动重启** — 服务端通过 API 读写配置，运行时变更即生效。

## 运行方式

### 生产模式（已构建）
```bash
cd brainstorm-tool
npm start                           # 启动 Express 服务器，serve client/dist/
```
访问 `http://localhost:3456`

### 开发模式（前端热更新）
```bash
# 终端 1：启动后端
npm start

# 终端 2：启动 Vite dev server
cd client && npm run dev
```
Vite dev server 自动将 `/api` 和 `/socket.io` 代理到 `localhost:3456`。

### 构建前端
```bash
cd client && npm run build
```
**每次修改 `client/src/` 下的任何文件后都必须重新构建**，否则 `npm start` 访问的是旧构建产物。

### 重启服务
```bash
# Windows: 杀掉占用 3456 端口的进程
Get-NetTCPConnection -LocalPort 3456 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# 然后重新启动
npm start
```

## 修改代码的关键规则

### 1. 修改角色设定
- **文件**: `lib/personas.js`
- **结构**: 每个角色 5 段——你是谁 + 思维方式 + 发言风格 + 关注点 + 必须避免
- **全局纪律**: 每个角色设定末尾追加 `GLOBAL_RULES`——禁止自我介绍、禁止寒暄、禁止 Markdown 标记
- 修改后重启服务器即可，不需要前端构建

### 2. 修改 AI 提示词/上下文构建
- **文件**: `lib/orchestrator.js` → `buildContext()` 函数
- **核心策略**: 每轮只传角色设定 + 思维导图（压缩版全量讨论） + 上一轮其他人发言，绝不传其他 AI 的角色设定
- `maxTokens`: auto 轮次用 4096，思维导图用 2048
- 注意：改提示词后一定要在规则里重申"禁止寒暄"——否则 7B 小模型会自由发挥

### 3. 修改前端 UI
- shadcn/ui 组件在 `client/src/components/ui/`
- 所有颜色用 Tailwind 语义 class（`text-foreground`、`bg-primary` 等），禁止硬编码颜色值
- 深色模式覆盖写在 `client/src/index.css` 的 `.dark` 选择器下
- **改完前端必须 `cd client && npm run build`**

### 4. 修改服务端逻辑
- `server.js` 的 session 是单进程内存对象，重启丢失
- 历史记录保存在 `history.json`，当前会话并未持久化到文件（只有明确调用 `saveHistoryEntry()` 时才存）
- Socket 事件：`user_message`（用户观点）、`user_fact`（事实补充）、`reset_session`（清空会话）
- `currentHistoryId` 管理：initSession 时创建 → 每轮 human-led 后更新 → loadHistory 时切换到对应 ID → resetSession 时清空

### 5. 添加新 AI 供应商
- 在 `lib/providers/` 创建新文件，导出 `{ call, type }`
- 在 `lib/providers/index.js` 注册
- 前端配置面板自动适配 `openai-compatible`/`anthropic`/`gemini` 三种类型
- 连接测试逻辑在 `server.js` → `POST /api/test-connection`

## 设计规范速查

- **主色调**: `#5E6AD2` — HSL `239 52% 63%`，Tailwind: `bg-primary`, `text-primary`
- **字体**: Inter（正文）+ JetBrains Mono（等宽），Tailwind: `font-sans`, `font-mono`
- **深色模式**: class 策略，默认深色，CSS 变量驱动
- **完整规范**: 见 `DESIGN_TOKENS.md`

## 历史坑点（不要重蹈覆辙）

1. **不要混用 `currentHistoryId` 做只读判断**。它只管"侧边栏高亮"和"新消息存到哪条记录"，不管输入的 disabled 状态。

2. **`maxTokens` 太低会截断输出**。auto/human-led 轮次用 4096，思维导图用 2048。低于 1024 的中文输出会被严重截断。

3. **ResizeHandle 拖拽不要用 setState**。拖拽期间用原生 DOM `el.style.width`，mouseup 才同步回 React state。否则卡顿严重。

4. **markmap SVG 在深色模式下文字不可见**。`index.css` 已加 `.dark` 下的样式覆盖，使用 `!important` 覆盖 markmap 内联样式。新增可视化库时注意检查深色模式。

5. **config.json 的 `personaOverrides` 不应该包含 `personality` 字段**。角色设定由 `lib/personas.js` 内置预设统一管理，overrides 只管理供应商和模型分配。

6. **Qwen 2.5 7B 等小模型中文输出质量差**。会出现乱加"段"前缀、引号不配对、丢字等问题。如果质量要求高，优先用 Gemini Flash 或 DeepSeek V3。

## 测试连接

```bash
# 测试 API 是否正常
curl http://localhost:3456/api/session

# 测试历史列表
curl http://localhost:3456/api/history
```
