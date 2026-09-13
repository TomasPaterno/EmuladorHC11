import { useState } from "react";
import { CcrFlags, FieldChange } from "../../ipc/emulator";

type FlagKey = "s" | "x" | "h" | "i" | "n" | "z" | "v" | "c";

interface FlagMeta {
  key: FlagKey;
  bitIndex: number;
  name: string;
  fullName: string;
  description: string;
}

const CCR_FLAGS_INFO: FlagMeta[] = [
  {
    key: "s",
    bitIndex: 7,
    name: "S",
    fullName: "Stop Disable",
    description:
      "Deshabilita la instrucción STOP cuando vale 1. Si está activo, STOP se comporta como NOP para prevenir la detención accidental.",
  },
  {
    key: "x",
    bitIndex: 6,
    name: "X",
    fullName: "X-Interrupt Mask",
    description:
      "Máscara de interrupción externa XIRQ. Si vale 1, inhibe las interrupciones XIRQ. Solo se inicializa en 1 tras Reset.",
  },
  {
    key: "h",
    bitIndex: 5,
    name: "H",
    fullName: "Half Carry",
    description:
      "Acarreo medio entre el bit 3 y 4. Se genera en operaciones de suma y se emplea en la corrección decimal BCD.",
  },
  {
    key: "i",
    bitIndex: 4,
    name: "I",
    fullName: "Interrupt Mask",
    description:
      "Máscara global para interrupciones por IRQ externa y periféricos internos. Si vale 1, las interrupciones están inhibidas.",
  },
  {
    key: "n",
    bitIndex: 3,
    name: "N",
    fullName: "Negative",
    description:
      "Indicador de negativo. Refleja directamente el bit más significativo (MSB, bit 7) del resultado de la última operación.",
  },
  {
    key: "z",
    bitIndex: 2,
    name: "Z",
    fullName: "Zero",
    description:
      "Indicador de cero. Se activa en 1 cuando el resultado de la última operación aritmética, lógica o de prueba es exactamente 0.",
  },
  {
    key: "v",
    bitIndex: 1,
    name: "V",
    fullName: "Two's Complement Overflow",
    description:
      "Desbordamiento de signo en aritmética con signo. Indica si una operación generó un resultado fuera de rango (-128 a +127).",
  },
  {
    key: "c",
    bitIndex: 0,
    name: "C",
    fullName: "Carry / Borrow",
    description:
      "Acarreo o préstamo. Refleja si hubo un acarreo saliente del bit 7 en sumas o un préstamo en operaciones de resta.",
  },
];

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function binByte(value: number) {
  return value.toString(2).padStart(8, "0");
}

interface CcrViewerProps {
  flags: CcrFlags | null;
  rawCcr: number | null;
  recentChanges?: FieldChange[];
  headless?: boolean;
}

export function CcrViewer({
  flags,
  rawCcr,
  recentChanges = [],
  headless = false,
}: CcrViewerProps) {
  const [hoveredKey, setHoveredKey] = useState<FlagKey | null>(null);

  const changedSet = new Set(
    recentChanges.map((change) => change.name.toLowerCase()),
  );

  const activeMeta = hoveredKey
    ? CCR_FLAGS_INFO.find((f) => f.key === hoveredKey)
    : null;

  const innerContent = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs font-medium text-amber-400">
          ${rawCcr !== null ? hexByte(rawCcr) : "--"}
        </span>
        <span className="font-mono text-xs text-slate-500">
          %{rawCcr !== null ? binByte(rawCcr) : "--------"}
        </span>
      </div>

      {/* Grid of 8 bits */}
      <div
        className="grid grid-cols-8 gap-1.5"
        role="group"
        aria-label="Banderas de condición CCR"
      >
        {CCR_FLAGS_INFO.map((item) => {
          const isSet = flags ? flags[item.key] : false;
          const wasChanged = changedSet.has(item.key);
          const isHovered = hoveredKey === item.key;

          return (
            <div
              key={item.key}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() =>
                setHoveredKey((curr) => (curr === item.key ? null : curr))
              }
              className={`relative flex flex-col items-center justify-center rounded-md border p-1.5 transition-all cursor-help ${
                isSet
                  ? "border-amber-500/60 bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/10"
                  : "border-slate-800 bg-slate-950/40 text-slate-500 hover:border-slate-700"
              } ${wasChanged ? "ring-1 ring-cyan-400" : ""} ${
                isHovered ? "ring-2 ring-amber-400/80" : ""
              }`}
              title={`${item.name}: ${item.fullName}`}
            >
              <span className="text-[11px] font-bold tracking-tight">
                {item.name}
              </span>
              <span
                className={`font-mono text-xs font-bold ${
                  isSet ? "text-amber-400" : "text-slate-600"
                }`}
              >
                {flags ? (isSet ? "1" : "0") : "—"}
              </span>
              <span className="text-[9px] text-slate-600">
                b{item.bitIndex}
              </span>
            </div>
          );
        })}
      </div>

      {activeMeta ? (
        <div
          className="mt-2.5 rounded border border-amber-500/40 bg-slate-950/80 px-3 py-1.5 text-xs transition-all"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400">
              Bit {activeMeta.bitIndex} ({activeMeta.name}) -{" "}
              {activeMeta.fullName}:
            </span>
            <span
              className={`rounded px-1 text-[10px] font-semibold ${
                flags && flags[activeMeta.key]
                  ? "bg-amber-400/20 text-amber-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {flags && flags[activeMeta.key] ? "1 (Activo)" : "0 (Inactivo)"}
            </span>
          </div>
          <p className="mt-0.5 text-slate-300 leading-relaxed">
            {activeMeta.description}
          </p>
        </div>
      ) : null}
    </>
  );

  if (headless) {
    return innerContent;
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="border-b border-slate-800/80 pb-2 mb-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Registro CCR
        </span>
      </div>
      {innerContent}
    </div>
  );
}
