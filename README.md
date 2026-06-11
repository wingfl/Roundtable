# 头脑风暴工坊 (Brainstorm Workshop)

多 AI 角色对抗式头脑风暴工具 — React + shadcn/ui + Socket.IO。

**核心思路**：单一 AI 容易附和人类——换个模型等于换个人陪聊。让 5 个不同立场的 AI 角色（魔鬼代言人、远见者、落地者、用户之声、哲人）用不同的大模型同时发言，观点真正碰撞。

---

## 文档索引

| 文档 | 内容 |
|---|---|
| **[PRODUCT.md](./PRODUCT.md)** | 产品定位、功能说明、角色系统、操作指南、路线图 |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | 技术架构、数据流、状态机、Socket 协议、扩展指南 |
| **[DESIGN_TOKENS.md](./DESIGN_TOKENS.md)** | 设计规范 — 颜色、字体、间距、组件变体 |

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite + Tailwind CSS 3 + shadcn/ui (Radix UI) |
| 后端 | Express + Socket.IO |
| AI 适配 | OpenAI 兼容 / Anthropic / Gemini |
| 可视化 | markmap（思维导图） |
| 图标 | Lucide React |

## 设计规范

- **主色调**：`#5E6AD2`（Linear 蓝紫色，HSL `239 52% 63%`）
- **字体**：Inter（正文）+ JetBrains Mono（等宽/代码）
- **深色模式**：CSS 变量驱动，class 策略，默认深色
- **主题切换**：顶部导航栏最右侧的太阳/月亮图标 → 浅色/深色/跟随系统
- **完整规范**：见 [DESIGN_TOKENS.md](./DESIGN_TOKENS.md)

---

## 快速开始

### 环境要求

- Node.js >= 18
- 至少一个 AI 服务 API Key（推荐 Gemini：**免费**）

### 安装运行

```bash
cd brainstorm-tool
npm install                    # 后端依赖
cd client && npm install && npm run build && cd ..  # 前端依赖 + 构建
npm start                      # 启动 → http://localhost:3456
```

### 开发模式

```bash
# 终端 1：后端
npm start

# 终端 2：前端热更新
cd client && npm run dev
```

Vite dev server 自动代理 `/api` 和 `/socket.io` 到 `localhost:3456`。

### 首次配置

**方式一（推荐）**：复制配置模板，填入 API Key
```bash
cp config.example.json config.json
# 编辑 config.json，把 YOUR_API_KEY 替换成真实 Key
```

**方式二**：通过界面配置
1. 点击顶部 ⚙ 设置 → AI 供应商 → 添加供应商
2. 角色管理 → 为每个角色分配供应商和模型
3. 保存

> ⚠️ `config.json` 已在 `.gitignore` 中，不会提交到仓库。上传仓库前请确认没有意外提交。

**推荐入门配置**：添加 Gemini（免费），模型选 `gemini-2.5-flash`，全部角色分配 Gemini Flash。

---

## 项目结构

```
brainstorm-tool/
├── server.js                    # Express + Socket.IO 入口，会话管理
├── config.json                  # 用户配置（供应商、角色覆盖）
├── history.json                 # 历史记录持久化
├── package.json                 # 后端依赖
├── PRODUCT.md                   # 产品文档
├── ARCHITECTURE.md              # 技术架构文档
├── DESIGN_TOKENS.md             # 设计规范
├── README.md                    # 本文件
├── lib/
│   ├── personas.js              # 5 个预设角色的详细人格设定
│   ├── orchestrator.js          # 辩论编排引擎
│   ├── history.js               # 历史记录 CRUD
│   ├── config.js                # 配置文件读写
│   └── providers/
│       ├── index.js             # 供应商路由
│       ├── openai.js            # OpenAI 兼容协议
│       ├── anthropic.js         # Anthropic Claude
│       └── gemini.js            # Google Gemini
├── client/
│   ├── vite.config.js           # Vite 配置（dev proxy → 3456）
│   ├── index.html               # HTML 入口
│   ├── src/
│   │   ├── App.jsx              # 根组件 + ResizeHandle + 布局
│   │   ├── index.css            # Tailwind + markmap 深色模式覆盖
│   │   ├── hooks/               # useSession, useSocket, useTheme, useToast
│   │   ├── services/api.js      # REST API 封装
│   │   └── components/
│   │       ├── ui/              # shadcn/ui 组件
│   │       ├── chat/            # ChatPanel + MessageBubble
│   │       ├── mindmap/         # MindmapPanel (markmap)
│   │       ├── history/         # HistorySidebar
│   │       ├── settings/        # SettingsModal + SetupModal
│   │       └── layout/          # TopBar + ThemeToggle
│   └── dist/                    # 构建产物
└── .workbuddy/skills/           # AI 协作 Skill
```

---

## 预设角色

| 角色 | 立场 | 做什么 |
|---|---|---|
| 😈 魔鬼代言人 | 批判与质疑 | 找出逻辑漏洞、隐藏假设、边界条件 |
| 🔮 远见者 | 探索可能 | 跨领域类比、未来趋势、大胆假设 |
| 🔧 落地者 | 关注执行 | 拆解步骤、量化指标、风险预案 |
| 👤 用户之声 | 用户视角 | 模拟真实体验、操作路径摩擦 |
| 🦉 哲人 | 追问本质 | 重新定义问题、揭示隐含假设 |

每个角色的详细人格设定（思维方式、发言风格、关注点、避讳）见 `lib/personas.js`。

---

## 配置说明

### config.json

```json
{
  "providers": [
    {
      "id": "prov_xxx",
      "name": "我的 DeepSeek",
      "type": "openai-compatible",
      "endpoint": "https://api.deepseek.com/v1",
      "apiKey": "sk-...",
      "models": ["deepseek-chat", "deepseek-reasoner"]
    }
  ],
  "personaOverrides": {
    "devil": { "providerId": "prov_xxx", "model": "deepseek-chat" }
  }
}
```

**注意**：`personaOverrides` 只应包含供应商和模型的分配，角色设定由 `lib/personas.js` 内置预设统一管理。自定义角色的 `personality` 字段可以直接写在覆盖中。

---

## AI 上下文策略

每轮讨论中，每个 AI 角色只收到：
- 自己的角色设定
- 话题和背景信息
- **思维导图**（全量讨论的结构化压缩）
- 上一轮其他人的发言文本

AI 角色**不会**看到其他角色的设定、历史全量消息堆栈。这确保了独立判断——每个角色只站在自己的立场发言。详见 [ARCHITECTURE.md](./ARCHITECTURE.md#4-ai-上下文构建策略)。

---

## License

MIT
