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
  const [programFormat, setProgramFormat] = useState<ByteFormat>("hex");
  const [dataFormat, setDataFormat] = useState<ByteFormat>("hex");

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
      {/* The Two Slices */}
      <div className="grid grid-cols-1 gap-3">
        {/* Slice 1: Memoria de Programa */}
        <MemorySliceView
          title="Porción 1: Memoria de Programa"
          badge={followPc ? "Siguiendo PC" : "Fijada"}
          view={programView}
          pc={pc}
          sp={sp}
          writeSet={writeSet}
          format={programFormat}
          busy={busy}
          onAddressChange={onProgramAddressChange}
          onWriteByte={onWriteByte}
          headerControls={
            <div className="flex items-center gap-1.5">
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
              <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/90 p-0.5 shadow-inner">
                {(["hex", "dec", "bin"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setProgramFormat(fmt)}
                    className={`px-1.5 py-0.5 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                      programFormat === fmt
                        ? "bg-amber-400 text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        {/* Slice 2: Memoria de Datos */}
        <MemorySliceView
          title="Porción 2: Memoria de Datos"
          view={dataView}
          pc={pc}
          sp={sp}
          writeSet={writeSet}
          format={dataFormat}
          busy={busy}
          onAddressChange={onDataAddressChange}
          onWriteByte={onWriteByte}
          headerControls={
            <div className="flex flex-wrap items-center gap-1.5">
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
              <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/90 p-0.5 shadow-inner">
                {(["hex", "dec", "bin"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setDataFormat(fmt)}
                    className={`px-1.5 py-0.5 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                      dataFormat === fmt
                        ? "bg-amber-400 text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
