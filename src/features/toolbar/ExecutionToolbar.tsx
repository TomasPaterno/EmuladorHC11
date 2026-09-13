import { FormEvent } from "react";
import { RunInfo } from "../../ipc/emulator";

interface ExecutionToolbarProps {
  busy: boolean;
  cycles: number | null;
  runInfo: RunInfo | null;
  maxSteps: string;
  onMaxStepsChange: (val: string) => void;
  onReset: () => void;
  onStep: () => void;
  onRun: () => void;
  onOpenS19: () => void;
  onOpenListing: () => void;
  onOpenManualLoad: () => void;
}

export function ExecutionToolbar({
  busy,
  cycles,
  runInfo,
  maxSteps,
  onMaxStepsChange,
  onReset,
  onStep,
  onRun,
  onOpenS19,
  onOpenListing,
  onOpenManualLoad,
}: ExecutionToolbarProps) {
  function handleRunSubmit(e: FormEvent) {
    e.preventDefault();
    onRun();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-5 py-3 shadow-md">
      {/* Brand / CPU Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-amber-400/20 px-2 py-1 font-mono text-xs font-black tracking-widest text-amber-400 border border-amber-400/30">
            MC68HC11E9
          </span>
          <h1 className="text-base font-bold text-slate-100 tracking-tight hidden sm:inline">
            Emulador
          </h1>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* Global Status Info */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">
            Ciclos:{" "}
            <strong className="text-amber-400 font-semibold">
              {cycles !== null ? cycles : "0"}
            </strong>
          </span>

          {runInfo && (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-sans ${
                runInfo.stopReason === "limit"
                  ? "bg-blue-950/60 text-blue-300 border border-blue-800/40"
                  : "bg-amber-950/60 text-amber-300 border border-amber-800/40"
              }`}
            >
              {runInfo.stepsTaken} pasos (
              {runInfo.stopReason === "limit" ? "límite" : "no impl."})
            </span>
          )}
        </div>
      </div>

      {/* Control Buttons Group */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Controles de ejecución"
      >
        {/* Reset */}
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          className="rounded-lg bg-amber-400 hover:bg-amber-300 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          title="Reinicia la CPU y carga el vector de RESET ($FFFE)"
        >
          Reset
        </button>

        {/* Step */}
        <button
          type="button"
          disabled={busy}
          onClick={onStep}
          className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 text-xs font-bold text-slate-100 transition-all disabled:opacity-50 cursor-pointer"
          title="Ejecuta una única instrucción (Paso a paso)"
        >
          Step ▶
        </button>

        {/* Run Form */}
        <form onSubmit={handleRunSubmit} className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 px-1.5 py-1">
            <span className="text-[11px] text-slate-400 mr-1 select-none">
              Pasos:
            </span>
            <input
              type="text"
              inputMode="numeric"
              className="w-12 bg-transparent font-mono text-xs text-slate-100 outline-none text-right"
              value={maxSteps}
              onChange={(e) => onMaxStepsChange(e.target.value)}
              title="Cantidad máxima de pasos para Run"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-100 hover:bg-white px-3.5 py-1.5 text-xs font-bold text-slate-950 transition-all disabled:opacity-50 cursor-pointer"
            title="Ejecuta hasta agotar pasos o encontrar opcode no implementado"
          >
            Run ⏩
          </button>
        </form>

        <div className="h-4 w-px bg-slate-800 hidden md:block" />

        {/* Quick Load Buttons */}
        <div className="hidden md:flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={onOpenListing}
            className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Listado
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onOpenS19}
            className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            S19
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onOpenManualLoad}
            className="rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            title="Cargar bytes hexadecimales arbitrarios"
          >
            Bytes...
          </button>
        </div>
      </div>
    </header>
  );
}
