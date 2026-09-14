import { CpuSnapshot, LastStep } from "../../ipc/emulator";

export interface HistoryItem {
  id: string;
  step: LastStep;
  snapshot: CpuSnapshot;
  timestamp: number;
}

interface ExecutionTimelineProps {
  history: HistoryItem[];
  selectedIndex: number | null;
  onSelectStep: (index: number | null) => void;
  onClearHistory: () => void;
}

function hexWord(val: number): string {
  return (val & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

export function ExecutionTimeline({
  history,
  selectedIndex,
  onSelectStep,
  onClearHistory,
}: ExecutionTimelineProps) {
  const isLive = selectedIndex === null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Línea de Tiempo ({history.length} pasos)
          </span>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              EN VIVO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-500/40">
              MODO INSPECCIÓN
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isLive && (
            <button
              type="button"
              onClick={() => onSelectStep(null)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors cursor-pointer"
            >
              Volver a En Vivo ➜
            </button>
          )}
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Historical Inspection Notice */}
      {!isLive && selectedIndex !== null && history[selectedIndex] && (
        <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-bold">
              Inspeccionando paso #{selectedIndex + 1}:
            </span>
            <span className="font-mono font-bold">
              {history[selectedIndex].step.mnemonic}
            </span>
            <span className="text-amber-400 font-mono text-[11px]">
              (PC: ${hexWord(history[selectedIndex].step.pcBefore)})
            </span>
          </div>
          <span className="text-[10px] text-amber-300/80">
            El diagrama y los registros muestran el estado exacto en este
            instante
          </span>
        </div>
      )}

      {/* Horizontal timeline cards list */}
      {history.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-500 italic">
          No hay pasos previos registrados en esta sesión. Ejecuta instrucciones
          paso a paso para ver la trayectoria.
        </div>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
          {history.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            const isLatest = idx === history.length - 1;
            const writesCount = item.step.writes.length;
            const ccrCount = item.step.ccr.length;

            let cardClasses =
              "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700";
            if (isSelected) {
              cardClasses =
                "bg-amber-950/40 border-amber-400 text-amber-100 ring-2 ring-amber-400/40 shadow-md shadow-amber-500/10";
            } else if (isLatest && isLive) {
              cardClasses =
                "bg-emerald-950/30 border-emerald-500/60 text-emerald-200";
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectStep(idx)}
                className={`shrink-0 flex flex-col gap-1 p-2 rounded-lg border text-left transition-all cursor-pointer min-w-[105px] ${cardClasses}`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>#{idx + 1}</span>
                  <span>${hexWord(item.step.pcBefore)}</span>
                </div>
                <div className="font-mono text-xs font-bold tracking-wide">
                  {item.step.mnemonic}
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono mt-0.5">
                  <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                    +{item.step.cyclesAdded}c
                  </span>
                  {writesCount > 0 && (
                    <span className="px-1 py-0.2 rounded bg-purple-900/60 text-purple-300 border border-purple-500/30">
                      {writesCount}W
                    </span>
                  )}
                  {ccrCount > 0 && (
                    <span className="px-1 py-0.2 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-500/30">
                      CCR
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
