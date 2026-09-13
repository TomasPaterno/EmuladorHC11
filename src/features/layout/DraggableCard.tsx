import React, { useState } from "react";

export interface DraggableCardProps {
  id: string;
  title: string;
  badge?: string;
  isCollapsed?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onToggleCollapse?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragOver?: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}

export function DraggableCard({
  id,
  title,
  badge,
  isCollapsed = false,
  canMoveUp = true,
  canMoveDown = true,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver = false,
  headerExtra,
  children,
}: DraggableCardProps) {
  const [isHoveredGrip, setIsHoveredGrip] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, id)}
      onDragOver={(e) => onDragOver?.(e, id)}
      onDrop={(e) => onDrop?.(e, id)}
      onDragEnd={(e) => onDragEnd?.(e)}
      className={`flex flex-col rounded-xl border transition-all duration-150 ${
        isDragOver
          ? "border-amber-400 ring-2 ring-amber-400/60 bg-amber-950/20 scale-[1.01]"
          : "border-slate-800 bg-slate-900/70 hover:border-slate-700/80 shadow-md"
      }`}
    >
      {/* Draggable Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-3.5 py-2 select-none">
        <div className="flex items-center gap-2">
          {/* Grip handle */}
          <div
            onMouseEnter={() => setIsHoveredGrip(true)}
            onMouseLeave={() => setIsHoveredGrip(false)}
            className={`flex items-center justify-center p-1 rounded transition-colors cursor-grab active:cursor-grabbing ${
              isHoveredGrip
                ? "text-amber-400 bg-slate-800"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title="Arrastre este bloque para cambiar su posición"
          >
            <span className="text-xs font-mono tracking-tighter">⋮⋮</span>
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {title}
          </span>

          {badge && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300">
              {badge}
            </span>
          )}
        </div>

        {/* Header Right Controls */}
        <div className="flex items-center gap-1.5">
          {headerExtra}

          <div className="flex items-center border border-slate-800 rounded bg-slate-950/60">
            {/* Move Up */}
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={onMoveUp}
              className="px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded-l cursor-pointer"
              title="Mover bloque hacia arriba"
              aria-label={`Mover ${title} hacia arriba`}
            >
              ▲
            </button>

            {/* Move Down */}
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={onMoveDown}
              className="px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 rounded-r cursor-pointer"
              title="Mover bloque hacia abajo"
              aria-label={`Mover ${title} hacia abajo`}
            >
              ▼
            </button>
          </div>

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
