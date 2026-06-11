import { useEffect } from "react";
import { Trash2, Clock, Users, MessageSquare } from "lucide-react";
import { useSession } from "../../hooks/use-session";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function HistorySidebar({ visible, width = 260, onClose }) {
  const { historyList, currentHistoryId, loadHistory, viewHistory, deleteHistory, resetSession } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (visible) loadHistory();
  }, [visible, loadHistory]);

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    const isCurrent = item.id === currentHistoryId;
    await deleteHistory(item.id);
    toast({ title: "已删除", description: `"${item.topic}" 已从历史记录中移除`, duration: 3000 });
    if (isCurrent) {
      resetSession();
    } else {
      loadHistory();
    }
  };

  return (
    <div
      className={cn(
        "border-r flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden bg-card",
        visible ? "" : "w-0 border-r-0"
      )}
      style={visible ? { width: `${width}px` } : {}}
    >
      <div className="h-11 border-b flex items-center px-3 flex-shrink-0">
        <Clock className="h-4 w-4 text-muted-foreground mr-2" />
        <span className="text-sm font-medium">历史记录</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {historyList.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">暂无历史记录</p>
          )}
          {historyList.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                viewHistory(item.id);
                onClose();
              }}
              className={cn(
                "p-2 rounded-md cursor-pointer transition-colors group hover:bg-accent",
                currentHistoryId === item.id && "bg-accent"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-sm font-medium truncate flex-1">{item.topic}</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => handleDelete(e, item)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>删除记录</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Users className="h-3 w-3" />
                  {item.personaNames?.length || 0}
                </span>
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="h-3 w-3" />
                  {item.messageCount || 0}
                </span>
                <span>{item.mode === "auto" ? "自动" : "主导"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatDate(item.createdAt)}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
