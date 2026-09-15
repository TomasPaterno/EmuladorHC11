import { useMemo, useState } from "react";
import { CpuSnapshot, LastStep } from "../../ipc/emulator";
import { analyzeInstructionSemantics } from "./instructionSemantics";
import { DatapathDiagram, DatapathLayoutMode } from "./DatapathDiagram";
import { ExecutionTimeline, HistoryItem } from "./ExecutionTimeline";

interface VisualExecutionCardProps {
  lastStep: LastStep | null;
  snapshot: CpuSnapshot | null;
  history: HistoryItem[];
  onClearHistory: () => void;
}

export function VisualExecutionCard({
  lastStep,
  snapshot,
  history,
  onClearHistory,
}: VisualExecutionCardProps) {
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<
    number | null
  >(null);
  const [animated, setAnimated] = useState(true);
  const [layoutMode, setLayoutMode] = useState<DatapathLayoutMode>(() => {
    try {
      const saved = localStorage.getItem("datapath_layout_mode");
      if (
        saved === "auto" ||
        saved === "columns" ||
        saved === "stacked" ||
        saved === "compact"
      ) {
        return saved;
      }
    } catch {
      // Ignore
    }
    return "auto";
  });

  const handleLayoutModeChange = (mode: DatapathLayoutMode) => {
    setLayoutMode(mode);
    try {
      localStorage.setItem("datapath_layout_mode", mode);
    } catch {
      // Ignore
    }
  };

  // Active step and snapshot (historical or live)
  const activeStep = useMemo(() => {
    if (selectedHistoryIndex !== null && history[selectedHistoryIndex]) {
      return history[selectedHistoryIndex].step;
    }
    return lastStep;
  }, [selectedHistoryIndex, history, lastStep]);

  const activeSnapshot = useMemo(() => {
    if (selectedHistoryIndex !== null && history[selectedHistoryIndex]) {
      return history[selectedHistoryIndex].snapshot;
    }
    return snapshot;
  }, [selectedHistoryIndex, history, snapshot]);

  // Compute semantics for active step
  const semantic = useMemo(() => {
    return analyzeInstructionSemantics(activeStep, activeSnapshot);
  }, [activeStep, activeSnapshot]);

  return (
    <div className="flex flex-col gap-3">
      {/* Top action strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAnimated(!animated)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
              animated
                ? "bg-amber-400/20 text-amber-300 border-amber-500/40 hover:bg-amber-400/30"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 text-slate-300"
            }`}
            title="Activar o pausar la animación de flujo de buses"
          >
            <span
              className={`w-2 h-2 rounded-full ${animated ? "bg-amber-400 animate-ping" : "bg-slate-500"}`}
            ></span>
            {animated ? "Animaciones: ON" : "Animaciones: OFF"}
          </button>

          {/* Layout Mode Selector */}
          <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 px-1.5 font-medium select-none text-[10px]">
              Vista:
            </span>
            <button
              type="button"
              onClick={() => handleLayoutModeChange("auto")}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer text-[10px] ${
                layoutMode === "auto"
                  ? "bg-amber-400 text-slate-950 shadow-xs font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Auto-reacomodar según el ancho disponible (Recomendado)"
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => handleLayoutModeChange("columns")}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer text-[10px] ${
                layoutMode === "columns"
                  ? "bg-amber-400 text-slate-950 shadow-xs font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Forzar vista clásica de 3 columnas"
            >
              3 Cols
            </button>
            <button
              type="button"
              onClick={() => handleLayoutModeChange("stacked")}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer text-[10px] ${
                layoutMode === "stacked"
                  ? "bg-amber-400 text-slate-950 shadow-xs font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Vista apilada (Registros en fila superior, Bus y Memoria con ancho completo)"
            >
              Apilada
            </button>
            <button
              type="button"
              onClick={() => handleLayoutModeChange("compact")}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer text-[10px] ${
                layoutMode === "compact"
                  ? "bg-amber-400 text-slate-950 shadow-xs font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Vista compacta condensada (óptima para paneles angostos)"
            >
              Compacta
            </button>
          </div>
        </div>

        {selectedHistoryIndex !== null && (
          <button
            type="button"
            onClick={() => setSelectedHistoryIndex(null)}
            className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>●</span> Volver al Último Paso Ejecutado
          </button>
        )}
      </div>

      {/* Main Datapath Visualizer */}
      <DatapathDiagram
        semantic={semantic}
        lastStep={activeStep}
        snapshot={activeSnapshot}
        animated={animated}
        layoutMode={layoutMode}
        onLayoutModeChange={handleLayoutModeChange}
      />

      {/* Interactive History Timeline */}
      <ExecutionTimeline
        history={history}
        selectedIndex={selectedHistoryIndex}
        onSelectStep={setSelectedHistoryIndex}
        onClearHistory={onClearHistory}
      />
    </div>
  );
}
