import { CpuSnapshot, FieldChange } from "../../ipc/emulator";

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

function binByte(value: number) {
  const raw = value.toString(2).padStart(8, "0");
  return `${raw.slice(0, 4)} ${raw.slice(4)}`;
}

function binWord(value: number) {
  const raw = value.toString(2).padStart(16, "0");
  return `${raw.slice(0, 4)} ${raw.slice(4, 8)} ${raw.slice(8, 12)} ${raw.slice(12, 16)}`;
}

interface CpuRegistersProps {
  snapshot: CpuSnapshot | null;
  recentChanges?: FieldChange[];
  headless?: boolean;
  format?: "hex" | "bin" | "dec";
  onFormatToggle?: () => void;
}

export function CpuRegisters({
  snapshot,
  recentChanges = [],
  headless = false,
  format = "hex",
  onFormatToggle,
}: CpuRegistersProps) {
  const changedSet = new Set(
    recentChanges.map((change) => change.name.toUpperCase()),
  );

  const isBin = format === "bin";
  const isDec = format === "dec";

  const registers = [
    {
      id: "A",
      label: "A",
      sublabel: "Acumulador A",
      bits: 8,
      hex: snapshot ? `$${hexByte(snapshot.a)}` : "—",
      bin: snapshot ? `%${binByte(snapshot.a)}` : "—",
      dec: snapshot ? `${snapshot.a}` : "—",
      changed: changedSet.has("A"),
    },
    {
      id: "B",
      label: "B",
      sublabel: "Acumulador B",
      bits: 8,
      hex: snapshot ? `$${hexByte(snapshot.b)}` : "—",
      bin: snapshot ? `%${binByte(snapshot.b)}` : "—",
      dec: snapshot ? `${snapshot.b}` : "—",
      changed: changedSet.has("B"),
    },
    {
      id: "D",
      label: "D (A:B)",
      sublabel: "Acumulador Doble 16b",
      bits: 16,
      hex: snapshot ? `$${hexWord(snapshot.d)}` : "—",
      bin: snapshot ? `%${binWord(snapshot.d)}` : "—",
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
      bin: snapshot ? `%${binWord(snapshot.x)}` : "—",
      dec: snapshot ? `${snapshot.x}` : "—",
      changed: changedSet.has("IX") || changedSet.has("X"),
    },
    {
      id: "IY",
      label: "IY",
      sublabel: "Índice Y 16b",
      bits: 16,
      hex: snapshot ? `$${hexWord(snapshot.y)}` : "—",
      bin: snapshot ? `%${binWord(snapshot.y)}` : "—",
      dec: snapshot ? `${snapshot.y}` : "—",
      changed: changedSet.has("IY") || changedSet.has("Y"),
    },
    {
      id: "SP",
      label: "SP",
      sublabel: "Puntero de Pila",
      bits: 16,
      hex: snapshot ? `$${hexWord(snapshot.sp)}` : "—",
      bin: snapshot ? `%${binWord(snapshot.sp)}` : "—",
      dec: snapshot ? `${snapshot.sp}` : "—",
      changed: changedSet.has("SP"),
    },
    {
      id: "PC",
      label: "PC",
      sublabel: "Contador de Programa",
      bits: 16,
      hex: snapshot ? `$${hexWord(snapshot.pc)}` : "—",
      bin: snapshot ? `%${binWord(snapshot.pc)}` : "—",
      dec: snapshot ? `${snapshot.pc}` : "—",
      changed: changedSet.has("PC"),
    },
    {
      id: "INIT",
      label: "INIT",
      sublabel: "Mapeo RAM/Registros",
      bits: 8,
      hex: snapshot ? `$${hexByte(snapshot.init)}` : "—",
      bin: snapshot ? `%${binByte(snapshot.init)}` : "—",
      dec: snapshot ? `${snapshot.init}` : "—",
      changed: false,
    },
  ];

  const gridContent = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {registers.map((reg) => {
        const displayValue = isDec ? reg.dec : isBin ? reg.bin : reg.hex;
        const secondaryValue = isDec ? reg.hex : `d:${reg.dec}`;
        return (
          <div
            key={reg.id}
            className={`rounded-md border p-2 transition-all shadow-xs ${
              reg.changed
                ? "border-cyan-500/80 bg-cyan-950/30 ring-1 ring-cyan-500/50"
                : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-sm sm:text-base text-slate-200">
                {reg.label}
              </span>
              <span className="text-xs text-slate-400 font-mono font-medium">
                {reg.bits}b
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1 overflow-hidden">
              <span
                className={`font-mono font-bold truncate ${
                  isBin
                    ? reg.bits === 16
                      ? "text-xs sm:text-[13px] tracking-tight"
                      : "text-xs sm:text-sm tracking-tight"
                    : "text-lg sm:text-xl tracking-normal"
                } ${
                  reg.changed
                    ? "text-cyan-400"
                    : reg.id === "PC"
                      ? "text-amber-400"
                      : "text-slate-100"
                }`}
                title={`Hex: ${reg.hex} | Bin: ${reg.bin} | Dec: ${reg.dec}`}
              >
                {displayValue}
              </span>
              <span
                className="font-mono text-xs sm:text-sm text-slate-400 shrink-0 ml-1 font-medium"
                title={
                  isDec ? `Hexadecimal: ${reg.hex}` : `Decimal: ${reg.dec}`
                }
              >
                {secondaryValue}
              </span>
            </div>
          </div>
        );
      })}
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
        <div className="flex items-center gap-3 text-xs sm:text-sm">
          {onFormatToggle && (
            <button
              type="button"
              onClick={onFormatToggle}
              className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-mono font-bold text-amber-400 transition-colors cursor-pointer"
              title="Alternar formato Hexadecimal / Binario / Decimal"
            >
              {format.toUpperCase()}
            </button>
          )}
          <span className="text-slate-400">
            Ciclos totales:{" "}
            <strong className="font-mono text-amber-400 font-bold text-sm sm:text-base">
              {snapshot ? snapshot.cycles : "—"}
            </strong>
          </span>
        </div>
      </div>
      {gridContent}
    </div>
  );
}
