import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, GitBranch } from "lucide-react";
import { useSession } from "../../hooks/use-session";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

let markmapModule = null;

async function loadMarkmap() {
  if (markmapModule) return markmapModule;
  const [{ Transformer }, { Markmap }] = await Promise.all([
    import("markmap-lib"),
    import("markmap-view"),
  ]);
  markmapModule = { Transformer, Markmap };
  return markmapModule;
}

export function MindmapPanel({ width = 280 }) {
  const { mindmap } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [prevWidth, setPrevWidth] = useState(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const mmRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!mindmap || !svgRef.current) return;
      try {
        const { Transformer, Markmap } = await loadMarkmap();
        if (cancelled) return;

        const transformer = new Transformer();
        const { root } = transformer.transform(mindmap);

        if (mmRef.current) {
          mmRef.current.setData(root);
          mmRef.current.fit();
        } else {
          mmRef.current = Markmap.create(svgRef.current, {
            autoFit: true,
            colorFreezeLevel: 2,
            duration: 300,
          }, root);
        }
      } catch (e) {
        console.error("Mindmap render error:", e);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [mindmap]);

  const toggleCollapse = () => {
    if (collapsed) {
      setCollapsed(false);
    } else {
      if (panelRef.current) {
        setPrevWidth(panelRef.current.style.width || panelRef.current.offsetWidth + "px");
      }
      setCollapsed(true);
    }
  };

  const exportMindmap = () => {
    if (!mindmap) return;
    const blob = new Blob([mindmap], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brainstorm-mindmap-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!collapsed && prevWidth && panelRef.current) {
      panelRef.current.style.width = prevWidth;
      setTimeout(() => {
        mmRef.current?.fit();
      }, 350);
    }
  }, [collapsed]);

  return (
    <>
      <div
        ref={panelRef}
        className={cn(
          "border-l flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden",
          collapsed ? "w-0 border-l-0" : ""
        )}
        style={collapsed ? {} : { width: `${width}px` }}
      >
        <div className="h-10 border-b flex items-center justify-between px-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium">思维导图</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={exportMindmap} disabled={!mindmap} title="导出">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={toggleCollapse} title="折叠">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div ref={containerRef} className="flex-1 overflow-hidden">
          {!mindmap ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <GitBranch className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">讨论开始后将自动生成思维导图</p>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full" />
          )}
        </div>
      </div>

      {collapsed && (
        <button
          onClick={toggleCollapse}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-card border rounded-l-md px-1.5 py-4 shadow-sm hover:bg-accent transition-colors z-10"
          title="展开思维导图"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
    </>
  );
}
