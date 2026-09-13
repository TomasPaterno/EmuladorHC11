import { useMemo, useState } from "react";
import { LastStep, LoadSummary, MemoryView } from "../../ipc/emulator";
import { ByteFormat } from "../inspector/memoryFormat";
import { MemorySliceView } from "./MemorySliceView";

interface DualMemoryPanelProps {
  programView: MemoryView | null;
  dataView: MemoryView | null;
  pc: number | null;
  sp: number | null;
  lastStep: LastStep | null;
  programSummary: LoadSummary | null;
  followPc: boolean;
  busy?: boolean;
  onFollowPcChange: (follow: boolean) => void;
  onProgramAddressChange: (newStart: number) => void;
  onDataAddressChange: (newStart: number) => void;
  onWriteByte: (address: number, value: number) => void;
}

export function DualMemoryPanel({
  programView,
  dataView,
  pc,
  sp,
  lastStep,
  programSummary,
  followPc,
  busy = false,
  onFollowPcChange,
  onProgramAddressChange,
  onDataAddressChange,
  onWriteByte,
}: DualMemoryPanelProps) {
  const [format, setFormat] = useState<ByteFormat>("hex");

  const writeSet = useMemo(() => {
    const set = new Set<number>();
    for (const write of lastStep?.writes ?? []) {
      set.add(write.address);
    }
    return set;
  }, [lastStep]);

  const firstRangeStart = programSummary?.ranges?.[0]?.start ?? 0x2000;

  return (
    <div className="flex flex-col gap-3">
      {/* Global Memory Options Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Vista Dual de Memoria
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Formato:</span>
          <div className="inline-flex rounded-md border border-slate-800 bg-slate-950 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setFormat("hex")}
              className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                format === "hex"
                  ? "bg-amber-400 font-bold text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Hex
            </button>
            <button
              type="button"
              onClick={() => setFormat("bin")}
              className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                format === "bin"
                  ? "bg-amber-400 font-bold text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Bin
            </button>
            <button
              type="button"
              onClick={() => setFormat("dec")}
              className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                format === "dec"
                  ? "bg-amber-400 font-bold text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Dec
            </button>
          </div>
        </div>
      </div>

      {/* The Two Slices */}
      <div className="grid grid-cols-1 gap-3">
        {/* Slice 1: Memoria de Programa */}
        <MemorySliceView
          title="Porción 1: Memoria de Programa"
          badge={followPc ? "Siguiendo PC" : "Fijada"}
          view={programView}
          pc={pc}
          writeSet={writeSet}
          format={format}
          busy={busy}
          onAddressChange={onProgramAddressChange}
          onWriteByte={onWriteByte}
          headerControls={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onFollowPcChange(!followPc)}
                className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer ${
                  followPc
                    ? "bg-amber-400/20 text-amber-300 border border-amber-500/40"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                }`}
                title="Sigue automáticamente al PC en cada instrucción"
              >
                {followPc ? "● Seguir PC" : "Seguir PC"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onFollowPcChange(false);
                  onProgramAddressChange(firstRangeStart & 0xfff0);
                }}
                className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                title={`Ir al inicio del programa ($${firstRangeStart.toString(16).toUpperCase().padStart(4, "0")})`}
              >
                Inicio Prog
              </button>
            </div>
          }
        />

        {/* Slice 2: Memoria de Datos */}
        <MemorySliceView
          title="Porción 2: Memoria de Datos"
          view={dataView}
          pc={pc}
          writeSet={writeSet}
          format={format}
          busy={busy}
          onAddressChange={onDataAddressChange}
          onWriteByte={onWriteByte}
          headerControls={
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => onDataAddressChange(0x0000)}
                className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                title="RAM interna del HC11 ($0000 - $00FF)"
              >
                RAM $0000
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = sp !== null ? sp & 0xfff0 : 0x0040;
                  onDataAddressChange(target);
                }}
                className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                title="Zona del puntero de pila actual SP"
              >
                Pila SP
              </button>
              <button
                type="button"
                onClick={() => onDataAddressChange(0x1000)}
                className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                title="Bloque de registros de control y E/S ($1000)"
              >
                I/O $1000
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
