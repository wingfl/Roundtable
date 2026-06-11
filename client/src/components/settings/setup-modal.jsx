import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, Users, AlertCircle } from "lucide-react";
import { useSession } from "../../hooks/use-session";
import { api } from "../../services/api";
import { DEFAULT_PERSONAS } from "../../services/personas";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

function applyOverrides(personas, overrides = {}) {
  return personas.map((p) => {
    const override = overrides[p.id];
    if (!override) return p;
    return { ...p, ...override };
  });
}

export function SetupModal({ open, onClose }) {
  const { loadConfig, initSession, config } = useSession();
  const [providers, setProviders] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [topic, setTopic] = useState("");
  const [background, setBackground] = useState("");
  const [mode, setMode] = useState("human-led");
  const [maxRounds, setMaxRounds] = useState("5");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [customPersonas, setCustomPersonas] = useState([]);

  const allPersonas = useMemo(() => {
    return [...applyOverrides(DEFAULT_PERSONAS, overrides), ...customPersonas];
  }, [overrides, customPersonas]);

  const readyPersonas = useMemo(() => {
    return allPersonas.filter((p) => {
      const pid = p.providerId || overrides[p.id]?.providerId;
      const model = p.model || overrides[p.id]?.model;
      return pid && model;
    });
  }, [allPersonas, overrides]);

  useEffect(() => {
    if (open) {
      loadConfig().then((cfg) => {
        if (cfg) {
          setProviders(cfg.providers || []);
          setOverrides(cfg.personaOverrides || {});
          setCustomPersonas(cfg.personas || []);

          const allP = [...applyOverrides(DEFAULT_PERSONAS, cfg.personaOverrides || {}), ...(cfg.personas || [])];
          const ready = allP.filter((p) => {
            const pid = p.providerId || (cfg.personaOverrides || {})[p.id]?.providerId;
            const model = p.model || (cfg.personaOverrides || {})[p.id]?.model;
            return pid && model;
          });
          setSelectedIds(new Set(ready.map((p) => p.id)));
        }
      });
    }
  }, [open, loadConfig]);

  const togglePersona = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleStart = async () => {
    if (!topic.trim() || selectedIds.size < 2) return;
    const selectedPersonas = allPersonas
      .filter((p) => selectedIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        color: p.color,
        emoji: p.emoji,
        providerId: p.providerId || overrides[p.id]?.providerId || "",
        model: p.model || overrides[p.id]?.model || "",
        personality: p.personality || overrides[p.id]?.personality || "",
      }));

    await initSession({
      topic: topic.trim(),
      background: background.trim(),
      personaIds: selectedPersonas.map((p) => p.id),
      maxRounds: parseInt(maxRounds),
      mode,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl gap-3 p-5">
        <DialogHeader className="space-y-0">
          <DialogTitle className="text-base">新建会话</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">讨论话题 <span className="text-destructive">*</span></Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="例如: 如何提升用户留存率？" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">背景信息</Label>
              <Textarea value={background} onChange={(e) => setBackground(e.target.value)} placeholder="补充相关的背景、数据、约束条件..." className="min-h-[70px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">讨论模式</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("human-led")}
                  className={cn(
                    "flex-1 p-2.5 rounded-lg border text-left transition-colors",
                    mode === "human-led" ? "border-primary bg-primary/5" : "hover:bg-accent"
                  )}
                >
                  <p className="text-sm font-medium">人为主导</p>
                  <p className="text-xs text-muted-foreground mt-0.5">你每轮引导讨论方向</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("auto")}
                  className={cn(
                    "flex-1 p-2.5 rounded-lg border text-left transition-colors",
                    mode === "auto" ? "border-primary bg-primary/5" : "hover:bg-accent"
                  )}
                >
                  <p className="text-sm font-medium">自动讨论</p>
                  <p className="text-xs text-muted-foreground mt-0.5">AI 自动多轮辩论</p>
                </button>
              </div>
            </div>
            {mode === "auto" && (
              <div className="space-y-1.5">
                <Label className="text-sm">讨论轮数</Label>
                <Select value={maxRounds} onValueChange={setMaxRounds}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 5, 8, 10, 15].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} 轮</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">选择角色 <span className="text-destructive">*</span>（至少2个）</Label>
              <span className="text-xs text-muted-foreground">{selectedIds.size} 已选</span>
            </div>
            {readyPersonas.length === 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20 mb-2">
                <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                <p className="text-xs text-warning">请先在设置中为角色分配模型</p>
              </div>
            )}
            <ScrollArea className="h-[260px]">
              <div className="space-y-1 pr-2">
                {allPersonas.map((p) => {
                  const hasProvider = p.providerId || overrides[p.id]?.providerId;
                  const selected = selectedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => hasProvider && togglePersona(p.id)}
                      disabled={!hasProvider}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors",
                        selected && "border-primary bg-primary/5",
                        !selected && "border-transparent hover:bg-accent",
                        !hasProvider && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0" style={{ backgroundColor: p.color, color: "#fff" }}>
                        {p.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.role}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {hasProvider ? `${p.model || overrides[p.id]?.model || ""}` : "未分配模型"}
                        </p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                        selected ? "bg-primary border-primary" : "border-border"
                      )}>
                        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleStart} disabled={!topic.trim() || selectedIds.size < 2}>
            <Users className="h-4 w-4 mr-1.5" />
            开始讨论
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
