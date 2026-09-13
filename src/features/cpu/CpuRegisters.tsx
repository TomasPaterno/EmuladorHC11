import { CpuSnapshot, FieldChange } from "../../ipc/emulator";

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

interface CpuRegistersProps {
  snapshot: CpuSnapshot | null;
  recentChanges?: FieldChange[];
  headless?: boolean;
}

export function CpuRegisters({
  snapshot,
  recentChanges = [],
  headless = false,
}: CpuRegistersProps) {
  const changedSet = new Set(
    recentChanges.map((change) => change.name.toUpperCase()),
  );

  const registers = [
    {
      id: "A",
      label: "A",
      sublabel: "Acumulador A",
      bits: 8,
      hex: snapshot ? `$${hexByte(snapshot.a)}` : "—",
      dec: snapshot ? `${snapshot.a}` : "—",
      changed: changedSet.has("A"),
    },
    {
      id: "B",
      label: "B",
      sublabel: "Acumulador B",
      bits: 8,
      hex: snapshot ? `$${hexByte(snapshot.b)}` : "—",
      dec: snapshot ? `${snapshot.b}` : "—",
      changed: changedSet.has("B"),
    },
    {
      id: "D",
      label: "D (A:B)",
      sublabel: "Acumulador Doble 16b",
      bits: 16,
      hex: snapshot ? `$${hexWord(snapshot.d)}` : "—",
      dec: snapshot ? `${snapshot.d}` : "—",
      changed:
        changedSet.has("D") || changedSet.has("A") || changedSet.has("B"),
    },
    {
      id: "IX",
      label: "IX",
      sublabel: "Índice X 16b",
      bits: 16,
      hex: snapshot ? `$${hexWord(snapshot.x)}` : "—",
      dec: snapshot ? `${snapshot.x}` : "—",
      changed: changedSet.has("IX") || changedSet.has("X"),
    },
    {
      id: "IY",
      label: "IY",
      sublabel: "Índice Y 16b",
      bits: 16,
      hex: snapshot ? `$${hexWord(snapshot.y)}` : "—",
      dec: snapshot ? `${snapshot.y}` : "—",
      changed: changedSet.has("IY") || changedSet.has("Y"),
    },
    {
      id: "SP",
      label: "SP",
      sublabel: "Puntero de Pila",
      bits: 16,
      hex: snapshot ? `$${hexWord(snapshot.sp)}` : "—",
      dec: snapshot ? `${snapshot.sp}` : "—",
      changed: changedSet.has("SP"),
    },
    {
      id: "PC",
      label: "PC",
      sublabel: "Contador de Programa",
      bits: 16,
      hex: snapshot ? `$${hexWord(snapshot.pc)}` : "—",
      dec: snapshot ? `${snapshot.pc}` : "—",
      changed: changedSet.has("PC"),
    },
    {
      id: "INIT",
      label: "INIT",
      sublabel: "Mapeo RAM/Registros",
      bits: 8,
      hex: snapshot ? `$${hexByte(snapshot.init)}` : "—",
      dec: snapshot ? `${snapshot.init}` : "—",
      changed: false,
    },
  ];

  const gridContent = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {registers.map((reg) => (
        <div
          key={reg.id}
          className={`rounded-md border p-2 transition-all ${
            reg.changed
              ? "border-cyan-500/80 bg-cyan-950/30 ring-1 ring-cyan-500/50"
              : "border-slate-800/80 bg-slate-950/50 hover:border-slate-700"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-bold text-xs text-slate-300">
              {reg.label}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {reg.bits}b
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span
              className={`font-mono text-sm font-semibold tracking-wide ${
                reg.changed
                  ? "text-cyan-300"
                  : reg.id === "PC"
                    ? "text-amber-400"
                    : "text-slate-100"
              }`}
            >
              {reg.hex}
            </span>
            <span
              className="font-mono text-[10px] text-slate-500 truncate"
              title={`Decimal: ${reg.dec}`}
            >
              d:{reg.dec}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  if (headless) {
    return gridContent;
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Registros Internos
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            Ciclos totales:{" "}
            <strong className="font-mono text-amber-400">
              {snapshot ? snapshot.cycles : "—"}
            </strong>
          </span>
        </div>
      </div>
      {gridContent}
    </div>
  );
}
