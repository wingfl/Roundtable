# 头脑风暴工坊 · 设计规范 (Design Tokens)

> 本文档定义了项目的全部设计 Token 和组件规范。任何 UI 修改必须遵循此规范，确保全局统一。

---

## 1. 颜色系统 (Color System)

### 1.1 语义 Token (CSS Variables)

所有颜色通过 HSL 变量定义，深色/浅色两套值。**严禁在组件中硬编码颜色值。**

| Token | 用途 | 浅色值 `hsl(...)` | 深色值 `hsl(...)` |
|---|---|---|---|
| `--background` | 页面底色 | `220 20% 98%` | `225 18% 6%` |
| `--foreground` | 主文字色 | `222 20% 12%` | `210 20% 95%` |
| `--card` | 卡片背景 | `0 0% 100%` | `224 16% 9%` |
| `--card-foreground` | 卡片文字 | `222 20% 12%` | `210 20% 95%` |
| `--popover` | 弹出层背景 | `0 0% 100%` | `224 16% 9%` |
| `--popover-foreground` | 弹出层文字 | `222 20% 12%` | `210 20% 95%` |
| `--primary` | 主色调 (蓝紫) | `239 52% 63%` | `239 55% 68%` |
| `--primary-foreground` | 主色调上文字 | `0 0% 100%` | `0 0% 100%` |
| `--secondary` | 次要色 (蓝灰) | `220 14% 94%` | `223 14% 14%` |
| `--secondary-foreground` | 次要色上文字 | `222 20% 20%` | `210 20% 92%` |
| `--muted` | 弱化背景 | `220 14% 94%` | `223 14% 14%` |
| `--muted-foreground` | 弱化文字 | `220 8% 46%` | `215 10% 56%` |
| `--accent` | 强调色(hover) | `222 15% 92%` | `222 14% 17%` |
| `--accent-foreground` | 强调色文字 | `222 20% 16%` | `210 20% 92%` |
| `--destructive` | 破坏性(红) | `0 84% 55%` | `0 72% 55%` |
| `--destructive-foreground` | 破坏性文字 | `0 0% 100%` | `0 0% 100%` |
| `--success` | 成功(绿) | `142 71% 40%` | `142 71% 40%` |
| `--success-foreground` | 成功文字 | `0 0% 100%` | `0 0% 100%` |
| `--warning` | 警告(黄) | `38 92% 45%` | `38 92% 48%` |
| `--warning-foreground` | 警告文字 | `0 0% 98%` | `0 0% 98%` |
| `--border` | 边框色 | `222 15% 88%` | `223 14% 16%` |
| `--input` | 输入框边框 | `222 15% 88%` | `223 14% 16%` |
| `--ring` | 聚焦环 | `239 52% 63%` | `239 55% 68%` |

### 1.2 主色调

- **Hex**: `#5E6AD2` (Light) / `#767EE0` (Dark)
- **HSL**: `239 52% 63%` (Light) / `239 55% 68%` (Dark)
- **参考**: Linear 蓝紫中间色

### 1.3 设计原则

- **背景**: 蓝灰基调而非纯黑/纯白 —— 深色模式用 `225 18% 6%`（深夜蓝），浅色用 `220 20% 98%`（冷白）
- **卡片**: 与背景有 3-4% 亮度差的区分层，边界清晰但不突兀
- **边框**: 深色模式 `16%` 亮度，淡到刚好可见，不影响内容聚焦
- **对比**: 所有层次间保持 2-3 级差异，形成视觉节奏但不过度跳跃

### 1.4 Tailwind 使用方式

```jsx
// 背景 → bg-background, bg-card, bg-primary, bg-secondary, bg-muted, bg-accent
// 文字 → text-foreground, text-muted-foreground, text-primary-foreground...
// 边框 → border-border, border-input
// 聚焦 → ring-ring
```

---

## 2. 字体系统 (Typography)

### 2.1 基准字号

```css
html { font-size: 17px; }  /* 全局基准 */
```

| 层级 | Tailwind class | 实际大小 | 使用场景 |
|---|---|---|---|
| 页面标题 | `text-base font-semibold` | 17px | Topbar 标题、Dialog 标题 |
| 正文 | `text-sm` | 14.875px (0.875rem) | 聊天消息、卡片列表、表单 |
| 辅助文字 | `text-xs` | 12.75px (0.75rem) | 时间戳、角色标签、轮次信息 |
| 微量文字 | `text-[11px]` | 11px | Badge 内文字、角色副标题 |

### 2.2 字体族

```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;  /* 正文 */
font-family: 'JetBrains Mono', Menlo, monospace;              /* 等宽/代码 */
```

- **Inter**: Google Fonts 引入，400/500/600 weight，UI 正文专用
- **JetBrains Mono**: 开发和代码引用场景

### 2.3 行高

- 聊天消息: `leading-relaxed` (1.625) — 保证长文可读性
- 一般文本: 默认 1.5 — Tailwind 基准

---

## 3. 间距系统 (Spacing)

基于 Tailwind 默认 4px 基准:

| 场景 | 间距 | Tailwind | 用途 |
|---|---|---|---|
| 微小间距 | 4px | `gap-1` / `p-1` | 按钮组、图标间距 |
| 紧凑间距 | 8px | `gap-2` / `p-2` | 卡片内边距、列表项间距 |
| 标准间距 | 12px | `gap-3` / `p-3` | 段落间距、弹框内边距 |
| 宽松间距 | 16px | `gap-4` / `p-4` | 大区块间距 |

**弹框内容区**: 统一 `p-5 gap-3`（20px 内边距 + 12px 栅格间距）

---

## 4. 组件规范

### 4.1 图标按钮

所有**无文字标签**的图标按钮必须包裹 `<Tooltip>`:

```jsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon-sm">
      <Settings className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>功能说明</TooltipContent>
</Tooltip>
```

### 4.2 表单布局

```jsx
{/* 标准表单字段 — label 与 input 间距 6px */}
<div className="space-y-1.5">
  <Label className="text-sm">字段名 <span className="text-destructive">*</span></Label>
  <Input ... />
  {error && <p className="text-xs text-destructive">{error}</p>}
</div>
```

### 4.3 必填标识

```jsx
<span className="text-destructive">*</span>
```

### 4.4 弹框尺寸

- 设置弹框: `max-w-2xl h-[620px]`
- 编辑弹框: `max-w-md`
- 新建会话: `max-w-2xl`
- 弹框 header: `DialogHeader space-y-0`, title `text-base`

---

## 5. 主题切换

- **实现**: CSS class `dark` 挂载在 `<html>` 上
- **防闪**: `index.html` 头部内联脚本，在 CSS 加载前读取 `localStorage`
- **选项**: ☀ 浅色 / 🌙 深色 / 💻 跟随系统
- **入口**: TopBar 最右侧太阳/月亮图标 → DropdownMenu
- **存储**: `localStorage` key = `brainstorm-theme`

---

## 6. 修改规则

1. **改颜色**: 只改 `src/index.css` 中的 CSS 变量，不要改组件
2. **改字体/间距**: 改本文件和 `tailwind.config.js`
3. **添加组件**: 参考 shadcn/ui 文档，保持变体名与现有一致
4. **必填校验**: 表单字段必须加 `*` 标记和校验错误提示
5. **图标按钮**: 必须加 Tooltip
