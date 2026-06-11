import { Brain, Settings, History } from "lucide-react";
import { useSession } from "../../hooks/use-session";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "../../lib/utils";

const STATUS_MAP = {
  idle: { label: "待开始", variant: "secondary" },
  ready: { label: "已准备", variant: "outline" },
  brainstorming: { label: "讨论中", variant: "default" },
  converging: { label: "已暂停", variant: "warning" },
};

export function TopBar({ onOpenSettings, onOpenSetup, onToggleHistory }) {
  const { topic, status, round, maxRounds, currentHistoryId } = useSession();
  const st = STATUS_MAP[status] || STATUS_MAP.idle;

  return (
    <header className="h-[52px] border-b flex items-center justify-between px-5 flex-shrink-0 bg-card">
      <div className="flex items-center gap-3">
        <Brain className="h-5 w-5 text-primary" />
        <span className="font-semibold text-base">头脑风暴工坊</span>
        <div className="h-5 w-px bg-border" />
        {topic ? (
          <span className="text-sm font-medium max-w-[300px] truncate">{topic}</span>
        ) : (
          <span className="text-sm text-muted-foreground">未设置话题</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {topic && (
          <>
            <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
            {round > 0 && (
              <span className="text-xs text-muted-foreground">
                第 {round}/{maxRounds} 轮
              </span>
            )}
          </>
        )}
        {currentHistoryId && (
          <Badge variant="secondary" className="text-xs">查看历史</Badge>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onToggleHistory}>
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>历史记录</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onOpenSetup}
              disabled={status === "brainstorming"}
            >
              <span className="text-lg leading-none">+</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>新建会话</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>全局设置</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ThemeToggle />
            </div>
          </TooltipTrigger>
          <TooltipContent>切换主题</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
