import { useCallback, useMemo, useState } from "react";
import { LastStep, LoadSummary, MemoryView } from "../../ipc/emulator";
import { ByteFormat, parseByteInput } from "../inspector/memoryFormat";

function hexByte(val: number): string {
  return (val & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(val: number): string {
  return (val & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function asciiChar(val: number): string {
  if (val >= 32 && val <= 126) {
    return String.fromCharCode(val);
  }
  return "·";
}

interface StackViewerProps {
  sp: number | null;
  pc: number | null;
  dataView: MemoryView | null;
  lastStep: LastStep | null;
  programSummary?: LoadSummary | null;
  followSp: boolean;
  busy?: boolean;
  onFollowSpChange: (follow: boolean) => void;
  onJumpAddress?: (address: number) => void;
  onWriteByte?: (address: number, value: number) => void;
}

export function StackViewer({
  sp,
  pc,
  dataView,
  lastStep,
  programSummary,
  followSp,
  busy = false,
  onFollowSpChange,
  onJumpAddress,
  onWriteByte,
}: StackViewerProps) {
  const [format, setFormat] = useState<ByteFormat>("hex");
  const [editingAddr, setEditingAddr] = useState<{
    addr: number;
    draft: string;
  } | null>(null);

  // Set of recently written addresses
  const writeSet = useMemo(() => {
    const set = new Set<number>();
    for (const write of lastStep?.writes ?? []) {
      set.add(write.address);
    }
    return set;
  }, [lastStep]);

  // Program address ranges to detect return addresses
  const programRanges = useMemo(
    () => programSummary?.ranges ?? [],
    [programSummary],
  );

  const isAddressInProgram = useCallback(
    (addr: number): boolean => {
      if (programRanges.length === 0) {
        // Default assume $2000-$7FFF or $C000-$FFFF if no summary
        return (
          (addr >= 0x2000 && addr <= 0x7fff) ||
          (addr >= 0xc000 && addr <= 0xffff)
        );
      }
      return programRanges.some((r) => addr >= r.start && addr <= r.end);
    },
    [programRanges],
  );

  // Create memory lookup map from dataView
  const memMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!dataView) return map;
    for (let i = 0; i < dataView.bytes.length; i++) {
      map.set((dataView.start + i) & 0xffff, dataView.bytes[i]);
    }
    return map;
  }, [dataView]);

  const currentSp = sp ?? 0x00ff;
  const tos = (currentSp + 1) & 0xffff;
  const isOutOfRam = currentSp > 0x01ff;

  // Stack depth estimate: standard HC11 starts stack at $00FF or $01FF
  const stackBase = currentSp > 0x00ff ? 0x01ff : 0x00ff;
  const estimatedDepth =
    currentSp <= stackBase ? Math.max(0, stackBase - currentSp) : 0;

  // Build the list of stack rows to display around SP
  // Show from SP - 1 (next upcoming push slot) down to SP + 12 (or stackBase)
  const rows = useMemo(() => {
    const list: Array<{
      addr: number;
      val: number | undefined;
      isSp: boolean;
      isTos: boolean;
      isWritten: boolean;
      relLabel: string;
      subroutineReturn?: number;
    }> = [];

    const start = (currentSp - 1 + 0x10000) & 0xffff;
    const count = 12; // 12 stack slots around SP

    for (let i = 0; i < count; i++) {
      const addr = (start + i) & 0xffff;
      const val = memMap.get(addr);
      const isSp = addr === currentSp;
      const isTos = addr === tos;
      const isWritten = writeSet.has(addr);

      const relLabel = isSp
        ? "SP (Libre)"
        : isTos
          ? "TOS (Tope)"
          : i > 2
            ? `TOS + ${i - 2}`
            : "Próximo PUSH";

      // Contextual return address check:
      // In HC11 JSR/BSR: PCL pushed at SP+2, PCH pushed at SP+1.
      // So at TOS (SP+1) is high byte, at SP+2 is low byte.
      let subroutineReturn: number | undefined;
      if (isTos && val !== undefined) {
        const nextVal = memMap.get((addr + 1) & 0xffff);
        if (nextVal !== undefined) {
          const potentialRet = (val << 8) | nextVal;
          if (isAddressInProgram(potentialRet)) {
            subroutineReturn = potentialRet;
          }
        }
      }

      list.push({
        addr,
        val,
        isSp,
        isTos,
        isWritten,
        relLabel,
        subroutineReturn,
      });
    }

    return list;
  }, [currentSp, tos, memMap, writeSet, isAddressInProgram]);

  function commitEdit(addr: number) {
    if (!editingAddr || editingAddr.addr !== addr) return;
    const parsed = parseByteInput(editingAddr.draft, format);
    if (parsed !== null && onWriteByte) {
      onWriteByte(addr, parsed);
    }
    setEditingAddr(null);
  }

  return (
    <div className="flex flex-col gap-3 font-sans text-xs">
      {/* Top Stat Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* SP Badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Puntero (SP):</span>
            <span className="rounded bg-purple-500/20 px-2 py-0.5 font-mono font-bold text-sm text-purple-300 border border-purple-500/40">
              ${hexWord(currentSp)}
            </span>
          </div>

          {/* TOS Badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Tope (TOS):</span>
            <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono font-bold text-sm text-amber-300 border border-amber-500/40">
              ${hexWord(tos)}
            </span>
          </div>

          {/* Depth Badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">En Pila:</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono font-semibold text-slate-200">
              {estimatedDepth} {estimatedDepth === 1 ? "byte" : "bytes"}
            </span>
          </div>

          {/* PC Badge */}
          {pc !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">PC:</span>
              <span className="rounded bg-amber-400/20 px-2 py-0.5 font-mono font-bold text-sm text-amber-300 border border-amber-500/40">
                ${hexWord(pc)}
              </span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onFollowSpChange(!followSp)}
            className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer ${
              followSp
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
            }`}
            title="Acompaña automáticamente el movimiento de SP en cada paso"
          >
            {followSp ? "● Seguir SP" : "Seguir SP"}
          </button>

          {onJumpAddress && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onJumpAddress(0x00ff & 0xfff0)}
              className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              title="Ir a la base de la pila ($00FF)"
            >
              Base $00FF
            </button>
          )}

          {/* Format selector */}
          <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/90 p-0.5 shadow-inner">
            {(["hex", "dec", "bin"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormat(fmt)}
                className={`px-1.5 py-0.5 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  format === fmt
                    ? "bg-purple-500 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Out of RAM warning */}
      {isOutOfRam && (
        <div className="rounded border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-200 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            <strong>Advertencia:</strong> El Stack Pointer ($
            {hexWord(currentSp)}) apunta fuera del área típica de RAM ($0000 -
            $01FF). Verifique la inicialización con <code>LDS</code>.
          </span>
        </div>
      )}

      {/* Structured Stack Frame Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 overflow-hidden shadow-inner">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-semibold text-slate-400">
                <th className="px-3 py-1.5 w-24">Posición</th>
                <th className="px-3 py-1.5 w-28">Dirección</th>
                <th className="px-3 py-1.5 w-24">Valor</th>
                <th className="px-3 py-1.5 w-16 text-center">ASCII</th>
                <th className="px-3 py-1.5">Contexto / Interpretación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-xs">
              {rows.map((row) => {
                const isEditing = editingAddr?.addr === row.addr;

                let rowBg = "hover:bg-slate-800/30";
                if (row.isSp) {
                  rowBg = "bg-purple-950/40 border-l-4 border-l-purple-500";
                } else if (row.isTos) {
                  rowBg = "bg-amber-950/40 border-l-4 border-l-amber-500";
                } else if (row.isWritten) {
                  rowBg = "bg-cyan-950/30 border-l-2 border-l-cyan-500";
                }

                return (
                  <tr key={row.addr} className={`transition-colors ${rowBg}`}>
                    {/* Relative Tag / Indicator */}
                    <td className="px-3 py-1.5 font-bold">
                      {row.isSp ? (
                        <span className="inline-flex items-center gap-1 rounded bg-purple-500/25 px-1.5 py-0.5 text-[11px] text-purple-300 font-bold border border-purple-500/50 shadow-2xs">
                          👉 SP (Libre)
                        </span>
                      ) : row.isTos ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/25 px-1.5 py-0.5 text-[11px] text-amber-300 font-bold border border-amber-500/50 shadow-2xs">
                          ⭐ TOS
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-[11px]">
                          {row.relLabel}
                        </span>
                      )}
                    </td>

                    {/* Physical Address */}
                    <td className="px-3 py-1.5 font-bold text-slate-300">
                      ${hexWord(row.addr)}
                    </td>

                    {/* Value cell (Editable on double-click) */}
                    <td className="px-3 py-1.5">
                      {row.val === undefined ? (
                        <span className="text-slate-600">??</span>
                      ) : isEditing ? (
                        <input
                          autoFocus
                          className="w-16 rounded bg-slate-900 px-1 py-0.5 text-center font-bold text-amber-300 outline-none ring-1 ring-purple-400 text-xs"
                          value={editingAddr.draft}
                          onChange={(e) =>
                            setEditingAddr({
                              addr: row.addr,
                              draft: e.target.value,
                            })
                          }
                          onBlur={() => commitEdit(row.addr)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitEdit(row.addr);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setEditingAddr(null);
                            }
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onDoubleClick={() =>
                            setEditingAddr({
                              addr: row.addr,
                              draft: hexByte(row.val!),
                            })
                          }
                          className={`rounded px-1.5 py-0.5 font-bold cursor-pointer transition-colors ${
                            row.isWritten
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : "hover:bg-slate-800 text-slate-100"
                          }`}
                          title="Doble clic para editar valor en la pila"
                        >
                          {format === "bin"
                            ? row.val.toString(2).padStart(8, "0")
                            : format === "dec"
                              ? row.val.toString(10)
                              : `$${hexByte(row.val)}`}
                        </button>
                      )}
                    </td>

                    {/* ASCII character */}
                    <td className="px-3 py-1.5 text-center text-slate-400 font-bold">
                      {row.val !== undefined ? asciiChar(row.val) : "·"}
                    </td>

                    {/* Context / Heuristics */}
                    <td className="px-3 py-1.5">
                      {row.subroutineReturn !== undefined ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-emerald-950/60 px-2 py-0.5 text-emerald-300 border border-emerald-500/40 font-semibold text-[11px]">
                          <span>🎯 Retorno de Subrutina [RTS] →</span>
                          <strong className="font-mono text-emerald-200">
                            ${hexWord(row.subroutineReturn)}
                          </strong>
                        </span>
                      ) : row.isWritten ? (
                        <span className="text-cyan-300 text-[11px] font-medium">
                          ✎ Modificado en el último paso
                        </span>
                      ) : row.isSp ? (
                        <span className="text-purple-300/90 font-medium italic text-[11px]">
                          Posición actual de SP; próximo PUSH escribirá aquí
                        </span>
                      ) : row.isTos ? (
                        <span className="text-amber-300/90 font-medium text-[11px]">
                          Último dato apilado activo; próximo PULL leerá aquí
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
