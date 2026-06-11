import { useState, useCallback, useRef, useEffect } from "react";
import { ThemeProvider } from "./hooks/use-theme";
import { ToastProvider } from "./hooks/use-toast";
import { SessionProvider } from "./hooks/use-session";
import { TooltipProvider } from "./components/ui/tooltip";
import { TopBar } from "./components/layout/topbar";
import { ChatPanel } from "./components/chat/chat-panel";
import { MindmapPanel } from "./components/mindmap/mindmap-panel";
import { HistorySidebar } from "./components/history/history-sidebar";
import { SettingsModal } from "./components/settings/settings-modal";
import { SetupModal } from "./components/settings/setup-modal";

function ResizeHandle({ onResize, direction }) {
  const ref = useRef(0);
  const startX = useRef(0);
  const startW = useRef(0);
  const targetEl = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMouseDown = (e) => {
      e.preventDefault();
      targetEl.current = direction === "left" ? el.previousElementSibling : el.nextElementSibling;
      if (!targetEl.current) return;
      startX.current = e.clientX;
      startW.current = targetEl.current.offsetWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      // 拖拽期间脱离 React，直接用 DOM 驱动宽度变化
      targetEl.current.style.transition = "none";

      const onMouseMove = (ev) => {
        const delta = direction === "right" ? startX.current - ev.clientX : ev.clientX - startX.current;
        const newW = Math.max(160, Math.min(500, startW.current + delta));
        targetEl.current.style.width = `${newW}px`;
        targetEl.current.style.flexBasis = `${newW}px`;
      };
      const onMouseUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        // 拖拽结束，恢复 transition 并同步回 React state
        targetEl.current.style.transition = "";
        const finalW = parseInt(targetEl.current.style.width, 10);
        if (!isNaN(finalW)) onResize(finalW);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };
    el.addEventListener("mousedown", onMouseDown);
    return () => el.removeEventListener("mousedown", onMouseDown);
  }, [onResize, direction]);

  return (
    <div
      ref={(node) => { ref.current = node; }}
      className="w-1.5 cursor-col-resize bg-transparent hover:bg-primary/30 transition-colors shrink-0 relative z-20"
    />
  );
}

function AppContent() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyWidth, setHistoryWidth] = useState(260);
  const [mindmapWidth, setMindmapWidth] = useState(280);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSetup={() => setSetupOpen(true)}
        onToggleHistory={() => setHistoryVisible((v) => !v)}
      />
      <div className="flex flex-1 min-h-0 relative">
        <HistorySidebar
          visible={historyVisible}
          width={historyWidth}
          onClose={() => setHistoryVisible(false)}
        />
        {historyVisible && (
          <ResizeHandle direction="left" onResize={setHistoryWidth} />
        )}
        <ChatPanel />
        <ResizeHandle direction="right" onResize={setMindmapWidth} />
        <MindmapPanel width={mindmapWidth} />
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider delayDuration={300}>
        <ToastProvider>
          <SessionProvider>
            <AppContent />
          </SessionProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
