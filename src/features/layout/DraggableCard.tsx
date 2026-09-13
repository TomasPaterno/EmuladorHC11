import React, { useRef, useState } from "react";

export interface DraggableCardProps {
  id: string;
  title: string;
  badge?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onDragStartBlock?: (id: string) => void;
  onDragOverBlock?: (id: string) => void;
  onDropBlock?: (sourceId: string, targetId: string) => void;
  isDragOver?: boolean;
  isDragging?: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}

export function DraggableCard({
  id,
  title,
  badge,
  isCollapsed = false,
  onToggleCollapse,
  onDragStartBlock,
  onDragOverBlock,
  onDropBlock,
  isDragOver = false,
  isDragging = false,
  headerExtra,
  children,
}: DraggableCardProps) {
  const [isHoveredGrip, setIsHoveredGrip] = useState(false);
  const isDraggingLocalRef = useRef(false);
  const startYRef = useRef(0);
  const activeTargetIdRef = useRef<string | null>(null);

  function findBlockAtY(clientY: number): string | null {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-block-id]"),
    );
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return card.getAttribute("data-block-id");
      }
    }
    // Fallback to closest vertical center if in gap between cards
    let closestId: string | null = null;
    let minDiff = Infinity;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const diff = Math.abs(clientY - mid);
      if (diff < minDiff) {
        minDiff = diff;
        closestId = card.getAttribute("data-block-id");
      }
    }
    return closestId;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return; // Only left mouse click
    e.preventDefault();
    e.stopPropagation();

    startYRef.current = e.clientY;
    isDraggingLocalRef.current = false;
    activeTargetIdRef.current = null;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.preventDefault();

    if (!isDraggingLocalRef.current) {
      if (Math.abs(e.clientY - startYRef.current) > 4) {
        isDraggingLocalRef.current = true;
        onDragStartBlock?.(id);
      }
    }

    if (isDraggingLocalRef.current) {
      const targetId = findBlockAtY(e.clientY);
      if (targetId && targetId !== id) {
        activeTargetIdRef.current = targetId;
        onDragOverBlock?.(targetId);
      } else if (targetId === id) {
        activeTargetIdRef.current = null;
      }
    }
  }

  function finishDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    if (isDraggingLocalRef.current) {
      const finalTarget = activeTargetIdRef.current ?? findBlockAtY(e.clientY);
      isDraggingLocalRef.current = false;
      activeTargetIdRef.current = null;
      if (finalTarget && finalTarget !== id) {
        onDropBlock?.(id, finalTarget);
      } else {
        onDropBlock?.(id, id);
      }
    }
  }

  return (
    <div
      data-block-id={id}
      className={`flex flex-col rounded-xl border transition-all duration-150 ${
        isDragging
          ? "opacity-60 scale-[0.99] border-amber-400/80 ring-2 ring-amber-400/50 bg-slate-900/90 shadow-2xl"
          : isDragOver
            ? "border-amber-400 ring-2 ring-amber-400/90 bg-amber-500/10 scale-[1.01]"
            : "border-slate-800 bg-slate-900/70 hover:border-slate-700/80 shadow-md"
      }`}
    >
      {/* Draggable Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-3.5 py-2 select-none">
        <div className="flex items-center gap-2">
          {/* Grip handle with captured pointer drag and prevented native drag */}
          <div
            draggable={false}
            onDragStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }}
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onMouseEnter={() => setIsHoveredGrip(true)}
            onMouseLeave={() => setIsHoveredGrip(false)}
            style={{ touchAction: "none", userSelect: "none" }}
            className={`flex items-center justify-center px-2 py-1 rounded transition-colors cursor-grab active:cursor-grabbing border ${
              isHoveredGrip
                ? "text-amber-300 bg-slate-800 border-amber-400/60 ring-1 ring-amber-400/40"
                : "text-slate-400 hover:text-amber-300 hover:bg-slate-800 border-slate-700/60"
            }`}
            title="Mantenga presionado y arrastre para mover de lugar este bloque"
          >
            <span className="text-sm font-mono tracking-tighter select-none font-black leading-none">
              ⋮⋮
            </span>
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {title}
          </span>

          {badge && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300">
              {badge}
            </span>
          )}

          {isDragOver && (
            <span className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950 uppercase tracking-wider animate-pulse">
              Mover aquí
            </span>
          )}
        </div>

        {/* Header Right Controls */}
        <div className="flex items-center gap-2">
          {headerExtra}

          {/* Collapse/Expand Toggle */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-xs font-mono font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title={isCollapsed ? "Expandir bloque" : "Colapsar bloque"}
              aria-label={
                isCollapsed ? `Expandir ${title}` : `Colapsar ${title}`
              }
            >
              {isCollapsed ? "+" : "−"}
            </button>
          )}
        </div>
      </div>

      {/* Card Content (if not collapsed) */}
      {!isCollapsed && <div className="p-3">{children}</div>}
    </div>
  );
}
