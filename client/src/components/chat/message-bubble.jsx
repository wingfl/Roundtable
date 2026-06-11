import { useState, useRef } from "react";
import { FileText, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const FACT_TOOLTIP_STYLE = {
  position: "fixed",
  zIndex: 9999,
  maxWidth: "320px",
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "calc(var(--radius) - 2px)",
  padding: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  fontSize: "13px",
};

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ msg, allFacts = [] }) {
  const [tooltip, setTooltip] = useState(null);

  if (msg.type === "system") {
    return (
      <div className="flex justify-center py-2">
        <div className="text-xs text-muted-foreground bg-muted/50 px-4 py-1.5 rounded-full border border-dashed border-border">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.type === "error") {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm text-destructive">{msg.content}</p>
      </div>
    );
  }

  if (msg.type === "persona_error") {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-destructive">
            {msg.persona?.emoji} {msg.persona?.name} 发言失败
          </p>
          <p className="text-sm text-destructive/80 mt-1">{msg.content}</p>
        </div>
      </div>
    );
  }

  if (msg.type === "thinking") {
    const p = msg.persona || {};
    return (
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
          style={{ backgroundColor: p.color || "#888", color: "#fff" }}
        >
          {p.emoji || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{p.name || "AI"}</span>
            <span className="text-xs text-muted-foreground">{p.role}</span>
            {msg.round && <span className="text-xs text-muted-foreground/60">第{msg.round}轮</span>}
          </div>
          <div className="rounded-xl rounded-tl-sm bg-card border px-4 py-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">思考中...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5">
          <p className="text-sm text-primary-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <p className="text-xs text-primary-foreground/50 mt-1 text-right">{formatTime(msg.timestamp)}</p>
        </div>
      </div>
    );
  }

  if (msg.type === "user_fact") {
    const factNum = allFacts.findIndex((f) => f.content === msg.content) + 1;
    return (
      <div
        className="flex justify-end"
        onMouseEnter={(e) => {
          if (allFacts.length > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({ x: rect.left, y: rect.top - 8, facts: allFacts });
          }
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <>
          {tooltip && (
            <div style={{ ...FACT_TOOLTIP_STYLE, left: tooltip.x, top: tooltip.y, transform: "translateY(-100%)" }}>
              <p className="font-semibold text-xs mb-2">已补充的事实信息</p>
              {tooltip.facts.map((f) => (
                <div key={f.num} className="flex gap-2 py-1 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground shrink-0">#{f.num}</span>
                  <span className="text-xs">{f.content}</span>
                </div>
              ))}
            </div>
          )}
          <div className="max-w-[75%] rounded-2xl rounded-br-md bg-success/10 border border-success/20 px-4 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <FileText className="h-3.5 w-3.5 text-success" />
              <span className="text-xs text-success font-medium">补充事实 {factNum > 0 ? `#${factNum}` : ""}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            <p className="text-xs text-muted-foreground mt-1 text-right">{formatTime(msg.timestamp)}</p>
          </div>
        </>
      </div>
    );
  }

  const p = msg.persona || {};
  const isThinking = false;

  return (
    <div className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
        style={{ backgroundColor: p.color || "#888", color: "#fff" }}
      >
        {p.emoji || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{p.name || "AI"}</span>
          <span className="text-xs text-muted-foreground">{p.role}</span>
          {msg.round && <span className="text-xs text-muted-foreground/60">第{msg.round}轮</span>}
        </div>
        <div className="rounded-xl rounded-tl-sm bg-card border px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{formatTime(msg.timestamp)}</p>
      </div>
    </div>
  );
}
