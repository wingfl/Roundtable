import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit, Wifi } from "lucide-react";
import { useSession } from "../../hooks/use-session";
import { api } from "../../services/api";
import { DEFAULT_PERSONAS } from "../../services/personas";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

const PROVIDER_TYPES = [
  { value: "openai-compatible", label: "OpenAI 兼容" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Google Gemini" },
];

const PROVIDER_HINTS = {
  "openai-compatible": "例如: https://api.openai.com/v1 或 https://api.siliconflow.cn/v1",
  anthropic: "例如: https://api.anthropic.com",
  gemini: "留空使用官方默认端点",
};

const PRESETS = {
  siliconflow: { name: "硅基流动", type: "openai-compatible", endpoint: "https://api.siliconflow.cn/v1" },
  deepseek: { name: "DeepSeek", type: "openai-compatible", endpoint: "https://api.deepseek.com/v1" },
  gemini: { name: "Gemini Flash", type: "gemini", endpoint: "" },
};

function applyOverrides(personas, overrides = {}) {
  return personas.map((p) => {
    const override = overrides[p.id];
    if (!override) return p;
    return { ...p, ...override };
  });
}

export function SettingsModal({ open, onClose }) {
  const { config, loadConfig } = useSession();
  const [tab, setTab] = useState("providers");
  const [providers, setProviders] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [mindmapConfig, setMindmapConfig] = useState({ providerId: "", model: "" });
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editType, setEditType] = useState("");
  const [editErrors, setEditErrors] = useState({});
  const [testLoading, setTestLoading] = useState(null);

  useEffect(() => {
    if (open) {
      loadConfig().then((cfg) => {
        if (cfg) {
          setProviders(cfg.providers || []);
          setOverrides(cfg.personaOverrides || {});
          setPersonas(applyOverrides(DEFAULT_PERSONAS, cfg.personaOverrides));
          setMindmapConfig(cfg.mindmapProvider || { providerId: "", model: "" });
        }
      });
    }
  }, [open, loadConfig]);

  const save = useCallback(async () => {
    const cfg = { 
      providers, 
      personas: [], 
      personaOverrides: overrides,
      mindmapProvider: mindmapConfig 
    };
    await api.saveConfig(cfg);
    loadConfig();
  }, [providers, overrides, mindmapConfig, loadConfig]);

  const openProviderEdit = (prov = null) => {
    setEditType("provider");
    setEditData(prov || { id: "", name: "", type: "openai-compatible", endpoint: "", apiKey: "", models: [] });
    setEditErrors({});
    setShowEdit(true);
  };

  const openPersonaEdit = (persona) => {
    setEditType("persona");
    const merged = { ...persona, ...(overrides[persona.id] || {}) };
    setEditData({
      id: persona.id,
      name: merged.name,
      role: merged.role,
      color: merged.color,
      emoji: merged.emoji,
      providerId: merged.providerId || "",
      model: merged.model || "",
      personality: merged.personality || "",
      isPreset: !!DEFAULT_PERSONAS.find((p) => p.id === persona.id),
    });
    setEditErrors({});
    setShowEdit(true);
  };

  const validateEdit = () => {
    const errors = {};
    if (editType === "provider") {
      if (!editData.name.trim()) errors.name = "请输入名称";
      if (editData.type !== "gemini" && !editData.endpoint.trim()) errors.endpoint = "请输入端点地址";
    } else {
      if (!editData.name.trim()) errors.name = "请输入名称";
      if (!editData.role.trim()) errors.role = "请输入角色";
      if (!editData.personality.trim()) errors.personality = "请输入角色设定";
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveEdit = async () => {
    if (!validateEdit()) return;

    if (editType === "provider") {
      const existing = providers.findIndex((p) => p.id === editData.id);
      const newProv = {
        ...editData,
        id: editData.id || `prov_${Date.now()}`,
      };

      let updated;
      if (existing >= 0) {
        updated = [...providers];
        updated[existing] = newProv;
      } else {
        updated = [...providers, newProv];
      }
      setProviders(updated);
      await api.saveConfig({ providers: updated, personas: [], personaOverrides: overrides });
    } else {
      if (editData.isPreset) {
        const newOverrides = {
          ...overrides,
          [editData.id]: {
            providerId: editData.providerId,
            model: editData.model,
            personality: editData.personality,
          },
        };
        setOverrides(newOverrides);
        setPersonas(applyOverrides(DEFAULT_PERSONAS, newOverrides));
        await api.saveConfig({ providers, personas: [], personaOverrides: newOverrides });
      } else {
        const existing = (config.personas || []).findIndex((p) => p.id === editData.id);
        const customPersonas = [...(config.personas || [])];
        const newPersona = {
          id: editData.id || `cust_${Date.now()}`,
          name: editData.name,
          role: editData.role,
          color: editData.color,
          emoji: editData.emoji,
          providerId: editData.providerId,
          model: editData.model,
          personality: editData.personality,
        };
        if (existing >= 0) customPersonas[existing] = newPersona;
        else customPersonas.push(newPersona);
        await api.saveConfig({ providers, personas: customPersonas, personaOverrides: overrides });
      }
    }

    setShowEdit(false);
    loadConfig();
  };

  const deleteProvider = async (id) => {
    const updated = providers.filter((p) => p.id !== id);
    const newOverrides = { ...overrides };
    Object.keys(newOverrides).forEach((pid) => {
      if (newOverrides[pid].providerId === id) delete newOverrides[pid];
    });
    setProviders(updated);
    setOverrides(newOverrides);
    await api.saveConfig({ providers: updated, personas: config.personas || [], personaOverrides: newOverrides });
    loadConfig();
  };

  const testConnection = async (providerId) => {
    setTestLoading(providerId);
    try {
      const res = await api.testConnection(providerId);
      alert(res.ok ? "连接成功！可用模型: " + (res.models?.join(", ") || "无") : "连接失败: " + res.error);
    } finally {
      setTestLoading(null);
    }
  };

  const fillPreset = (type) => {
    if (!PRESETS[type]) return;
    setEditType("provider");
    setEditData({ id: "", name: PRESETS[type].name, type: PRESETS[type].type, endpoint: PRESETS[type].endpoint, apiKey: "", models: [] });
    setEditErrors({});
    setShowEdit(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl h-[640px] flex flex-col gap-3 p-5">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-base">全局设置</DialogTitle>
          </DialogHeader>
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="h-9 shrink-0">
              <TabsTrigger value="providers" className="text-sm">AI 模型</TabsTrigger>
              <TabsTrigger value="personas" className="text-sm">角色管理</TabsTrigger>
              <TabsTrigger value="mindmap" className="text-sm">思维导图</TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0 mt-2">
              {tab === "providers" ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <div className="flex gap-2">
                      {Object.entries(PRESETS).map(([key, preset]) => (
                        <Button key={key} variant="outline" size="sm" className="h-8 text-xs" onClick={() => fillPreset(key)}>
                          + {preset.name}
                        </Button>
                      ))}
                    </div>
                    <Button size="sm" className="h-8 text-xs" onClick={() => openProviderEdit()}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      添加模型
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-2">
                      {providers.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{p.name}</span>
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">{p.type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{p.endpoint || "默认端点"}</p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon-sm" onClick={() => testConnection(p.id)} disabled={testLoading === p.id} title="测试连接">
                              <Wifi className={cn("h-4 w-4", testLoading === p.id && "animate-spin")} />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => openProviderEdit(p)} title="编辑">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => deleteProvider(p.id)} title="删除">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {providers.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">尚未配置 AI 模型，点击上方预设或添加按钮开始</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="space-y-2 pr-2">
                    {personas.map((p) => {
                      const hasProvider = p.providerId || overrides[p.id]?.providerId;
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0" style={{ backgroundColor: p.color, color: "#fff" }}>
                            {p.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground">{p.role}</span>
                              {DEFAULT_PERSONAS.find((dp) => dp.id === p.id) && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">预设</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {hasProvider ? "已配置模型" : "未分配模型"}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon-sm" onClick={() => openPersonaEdit(p)} title="编辑角色">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </Tabs>

          {tab === "mindmap" && (
            <div className="h-full flex flex-col gap-4">
              <div className="text-sm text-muted-foreground">
                配置用于生成思维导图的 AI 模型。建议使用响应快速、成本较低的模型。
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">选择模型供应商</Label>
                  <Select 
                    value={mindmapConfig.providerId || "none"} 
                    onValueChange={(v) => {
                      if (v === "none") {
                        setMindmapConfig({ providerId: "", model: "" });
                      } else {
                        const selectedProv = providers.find((p) => p.id === v);
                        const defaultModel = selectedProv?.models?.[0] || "";
                        setMindmapConfig({ providerId: v, model: defaultModel });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="选择模型供应商" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未配置（使用默认）</SelectItem>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">模型名称</Label>
                  <Input 
                    value={mindmapConfig.model || ""} 
                    onChange={(e) => setMindmapConfig({ ...mindmapConfig, model: e.target.value })} 
                    placeholder="例如: Qwen/Qwen2.5-7B-Instruct" 
                  />
                  {mindmapConfig.providerId && (
                    <p className="text-xs text-muted-foreground">
                      可用模型: {providers.find(p => p.id === mindmapConfig.providerId)?.models?.join(", ") || "无"}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={async () => {
                      await save();
                      alert("保存成功！");
                    }} 
                    className="flex-1"
                  >
                    保存配置
                  </Button>
                  {mindmapConfig.providerId && (
                    <Button 
                      variant="outline" 
                      onClick={async () => {
                        try {
                          const res = await api.testConnection(mindmapConfig.providerId);
                          alert(res.ok ? "连接成功！" : "连接失败: " + res.error);
                        } catch (e) {
                          alert("测试失败: " + e.message);
                        }
                      }}
                    >
                      测试连接
                    </Button>
                  )}
                </div>
                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">配置说明</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• 如果未配置，将使用第一个发言角色的模型生成思维导图</li>
                    <li>• 建议选择响应快速、支持长文本的模型</li>
                    <li>• 硅基流动的 Qwen2.5-7B-Instruct 是性价比不错的选择</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg gap-3 p-5">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-base">{editType === "provider" ? (editData?.id ? "编辑模型" : "添加模型") : "编辑角色"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editType === "provider" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm">名称 <span className="text-destructive">*</span></Label>
                  <Input value={editData?.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} placeholder="例如: GPT-4o, DeepSeek" />
                  {editErrors.name && <p className="text-xs text-destructive">{editErrors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">类型</Label>
                  <Select value={editData?.type || "openai-compatible"} onValueChange={(v) => {
                    setEditData({ ...editData, type: v, endpoint: v === "gemini" ? "" : editData?.endpoint });
                    setEditErrors({});
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">API 端点 <span className="text-destructive">*</span></Label>
                  <Input value={editData?.endpoint || ""} onChange={(e) => setEditData({ ...editData, endpoint: e.target.value })} placeholder="https://..." />
                  <p className="text-xs text-muted-foreground">{PROVIDER_HINTS[editData?.type]}</p>
                  {editErrors.endpoint && <p className="text-xs text-destructive">{editErrors.endpoint}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">API Key</Label>
                  <Input type="password" value={editData?.apiKey || ""} onChange={(e) => setEditData({ ...editData, apiKey: e.target.value })} placeholder="sk-..." />
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-sm">名称 <span className="text-destructive">*</span></Label>
                    <Input value={editData?.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                    {editErrors.name && <p className="text-xs text-destructive">{editErrors.name}</p>}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-sm">角色 <span className="text-destructive">*</span></Label>
                    <Input value={editData?.role || ""} onChange={(e) => setEditData({ ...editData, role: e.target.value })} />
                    {editErrors.role && <p className="text-xs text-destructive">{editErrors.role}</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">颜色</Label>
                    <Input type="color" value={editData?.color || "#000000"} onChange={(e) => setEditData({ ...editData, color: e.target.value })} className="w-14 h-9 p-0.5" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Emoji</Label>
                    <Input value={editData?.emoji || ""} onChange={(e) => setEditData({ ...editData, emoji: e.target.value })} className="w-20" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">分配模型</Label>
                  <Select value={editData?.providerId || "none"} onValueChange={(v) => {
                    if (v === "none") {
                      setEditData({ ...editData, providerId: "", model: "" });
                    } else {
                      const selectedProv = providers.find((p) => p.id === v);
                      const defaultModel = selectedProv?.models?.[0] || "";
                      setEditData({ ...editData, providerId: v, model: defaultModel });
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="选择模型供应商" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未分配</SelectItem>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">模型名称</Label>
                  <Input value={editData?.model || ""} onChange={(e) => setEditData({ ...editData, model: e.target.value })} placeholder="例如: gpt-4o, deepseek-chat" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">角色设定 (System Prompt) <span className="text-destructive">*</span></Label>
                  <Textarea value={editData?.personality || ""} onChange={(e) => setEditData({ ...editData, personality: e.target.value })} className="min-h-[80px]" />
                  {editErrors.personality && <p className="text-xs text-destructive">{editErrors.personality}</p>}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>取消</Button>
            <Button onClick={saveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
