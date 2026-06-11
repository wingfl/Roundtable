import { useState, useRef, useEffect, useCallback } from "react";
import { Send, StopCircle, Play, Lightbulb, FileText, MessageSquare } from "lucide-react";
import { useSession } from "../../hooks/use-session";
import { Button } from "../ui/button";
import { Textarea } from "../ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ScrollArea } from "../ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "../../lib/utils";
import { MessageBubble } from "./message-bubble";

export function ChatPanel() {
  const {
    topic,
    messages,
    status,
    mode,
    round,
    maxRounds,
    thinking,
    factCounter,
    allFacts,
    personas,
    sendMessage,
    startAuto,
    stopDebate,
    resumeAuto,
  } = useSession();

  const [input, setInput] = useState("");
  const [inputMode, setInputMode] = useState("opinion");
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input, inputMode);
    setInput("");
  }, [input, inputMode, sendMessage]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleModeChange = useCallback(
    (val) => {
      if (val === "auto" && status !== "brainstorming") {
        startAuto();
      } else if (val === "human-led" && status === "brainstorming") {
        stopDebate();
      }
    },
    [status, startAuto, stopDebate]
  );

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-3">
          {!topic && (
            <div className="flex flex-col items-center justify-center h-full text-center py-24">
              <Brain className="h-14 w-14 text-muted-foreground/25 mb-5" />
              <h2 className="text-xl font-semibold mb-2">开始一场头脑风暴</h2>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                点击右上角 <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">+</span> 按钮设置话题和角色，AI 团队将为你展开多视角讨论
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} allFacts={allFacts} />
          ))}

          {Object.entries(thinking).map(([pid]) => {
            const persona = personas.find(p => p.id === pid);
            return (
              <MessageBubble key={`thinking-${pid}`} msg={{ type: "thinking", personaId: pid, persona, round }} />
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {topic && (
        <div className="border-t p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <Select value={mode} onValueChange={handleModeChange}>
              <SelectTrigger className="w-[150px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="human-led">人为主导</SelectItem>
                <SelectItem value="auto">自动讨论</SelectItem>
              </SelectContent>
            </Select>

            {round > 0 && (
              <span className="text-xs text-muted-foreground">
                第 {round}/{maxRounds} 轮
              </span>
            )}

            {status === "brainstorming" && mode === "auto" && (
              <Button variant="destructive" size="sm" className="h-8 ml-auto" onClick={stopDebate}>
                <StopCircle className="h-4 w-4 mr-1" />
                停止
              </Button>
            )}

            {status === "converging" && mode === "auto" && (
              <Button variant="outline" size="sm" className="h-8 ml-auto" onClick={resumeAuto}>
                <Play className="h-4 w-4 mr-1" />
                继续
              </Button>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={inputMode === "opinion" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => setInputMode("opinion")}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      观点
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>发表个人观点加入讨论</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={inputMode === "fact" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => setInputMode("fact")}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      事实
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>补充客观事实信息</TooltipContent>
                </Tooltip>
                {factCounter > 0 && (
                  <span className="text-xs text-muted-foreground self-center ml-1">
                    已补充 {factCounter} 条
                  </span>
                )}
              </div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputMode === "fact" ? "补充事实信息 (Enter 发送，Shift+Enter 换行)" : "发表你的观点 (Enter 发送，Shift+Enter 换行)"}
                className="min-h-[52px] max-h-[120px] text-sm resize-none"
              />
            </div>
            <Button
              size="sm"
              className="h-9 shrink-0"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4 mr-1" />
              {inputMode === "fact" ? "补充" : "发送"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Brain({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5v1.5h-4v-1.5c-1.2-.7-2-2-2-3.5a4 4 0 0 1 4-4z" />
      <path d="M9 12c-1.5.7-3 2-3 3.5a4 4 0 0 0 8 0c0-1.5-1.5-2.8-3-3.5" />
      <path d="M9 16v2M15 16v2M10 20h4" />
    </svg>
  );
}
