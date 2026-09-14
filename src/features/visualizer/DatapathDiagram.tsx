import { useMemo, useState } from "react";
import { CpuSnapshot, LastStep } from "../../ipc/emulator";
import { InstructionSemantic } from "./instructionSemantics";

interface DatapathDiagramProps {
  semantic: InstructionSemantic | null;
  lastStep: LastStep | null;
  snapshot: CpuSnapshot | null;
  animated?: boolean;
}

function hexByte(val: number): string {
  return (val & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(val: number): string {
  return (val & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

export function DatapathDiagram({
  semantic,
  lastStep,
  snapshot,
  animated = true,
}: DatapathDiagramProps) {
  const [showAllFlags, setShowAllFlags] = useState(false);

  // Map of register changes
  const regChangesMap = useMemo(() => {
    const map = new Map<string, { from: number; to: number }>();
    if (!lastStep) return map;
    for (const change of lastStep.registers) {
      map.set(change.name.toUpperCase(), {
        from: change.from,
        to: change.to,
      });
    }
    return map;
  }, [lastStep]);

  // Map of CCR changes
  const ccrChangesMap = useMemo(() => {
    const map = new Map<string, { from: number; to: number }>();
    if (!lastStep) return map;
    for (const change of lastStep.ccr) {
      map.set(change.name.toUpperCase(), {
        from: change.from,
        to: change.to,
      });
    }
    return map;
  }, [lastStep]);

  if (!lastStep || !snapshot || !semantic) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500">
        <svg
          className="w-12 h-12 mb-3 text-slate-600 opacity-60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
          />
        </svg>
        <p className="font-semibold text-slate-400">
          Sin instrucción ejecutada
        </p>
        <p className="text-xs text-slate-600 mt-1 max-w-sm">
          Ejecuta una instrucción con <strong>Paso</strong> (F7) o inicia el
          programa para visualizar la ruta de datos y el flujo interactivo de la
          CPU.
        </p>
      </div>
    );
  }

  const categoryColorClass = {
    LOAD: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
    STORE: "bg-purple-500/15 text-purple-300 border-purple-500/40",
    ALU: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    BRANCH: "bg-blue-500/15 text-blue-300 border-blue-500/40",
    JUMP: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40",
    CALL: "bg-teal-500/15 text-teal-300 border-teal-500/40",
    RETURN: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    STACK: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    TRANSFER: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
    FLAG: "bg-lime-500/15 text-lime-300 border-lime-500/40",
    SYSTEM: "bg-slate-500/15 text-slate-300 border-slate-500/40",
  }[semantic.category];

  // Bus direction flags
  const isReadFlow =
    semantic.category === "LOAD" ||
    (semantic.category === "STACK" && semantic.mnemonic.startsWith("PUL")) ||
    semantic.sourceBlock === "MEMORY" ||
    semantic.sourceBlock === "STACK";

  const isWriteFlow =
    semantic.category === "STORE" ||
    (semantic.category === "STACK" && semantic.mnemonic.startsWith("PSH")) ||
    semantic.destBlock === "MEMORY" ||
    semantic.destBlock === "STACK";

  const isInternalFlow =
    semantic.category === "TRANSFER" ||
    semantic.category === "ALU" ||
    semantic.category === "FLAG";

  const isBranchOrJump =
    semantic.category === "BRANCH" ||
    semantic.category === "JUMP" ||
    semantic.category === "CALL" ||
    semantic.category === "RETURN";

  // Individual registers helper
  const renderRegBox = (
    name: string,
    width: "8" | "16",
    currentVal: number,
  ) => {
    const change = regChangesMap.get(name);
    const isModified = change !== undefined;
    const isInvolved = semantic.involvedRegisters.includes(name);

    let borderClass = "border-slate-800 bg-slate-900/80 text-slate-300";
    if (isModified) {
      borderClass =
        "border-amber-400 bg-amber-950/30 text-amber-200 shadow-sm shadow-amber-500/20";
    } else if (isInvolved) {
      borderClass = "border-cyan-500/70 bg-cyan-950/20 text-cyan-200";
    }

    return (
      <div
        className={`p-2 rounded-lg border transition-all ${borderClass} flex flex-col justify-between`}
      >
        <div className="flex items-center justify-between gap-1 text-[11px] font-bold font-mono">
          <span className="text-slate-400">{name}</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
            {width}-bit
          </span>
        </div>
        <div className="mt-1 font-mono text-xs font-semibold flex items-center justify-between">
          {isModified ? (
            <div className="flex items-center gap-1 w-full justify-between">
              <span className="text-slate-500 line-through text-[11px]">
                ${width === "8" ? hexByte(change.from) : hexWord(change.from)}
              </span>
              <span className="text-amber-400 text-[10px]">➜</span>
              <span className="text-amber-300 font-bold">
                ${width === "8" ? hexByte(change.to) : hexWord(change.to)}
              </span>
            </div>
          ) : (
            <span className="text-slate-200">
              ${width === "8" ? hexByte(currentVal) : hexWord(currentVal)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 text-slate-200 text-xs">
      {/* 1. Natural Language Instruction Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border ${categoryColorClass}`}
            >
              {semantic.mnemonic}
            </span>
            <span className="font-mono text-slate-400 text-[11px]">
              PC: ${hexWord(lastStep.pcBefore)} ➜ ${hexWord(lastStep.pcAfter)}
            </span>
            <span className="text-slate-500 text-[11px]">
              (+{lastStep.cyclesAdded} ciclos)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/60">
              {semantic.categoryLabel}
            </span>
          </div>
        </div>

        {/* Summary Description */}
        <div className="mt-2.5 text-xs text-slate-200 leading-relaxed font-medium">
          {semantic.summary}
        </div>
        {semantic.detail !== semantic.summary && (
          <div className="mt-1 text-[11px] text-slate-400">
            {semantic.detail}
          </div>
        )}

        {/* Branch decision banner if branch */}
        {semantic.branch?.isBranch && (
          <div
            className={`mt-2.5 p-2 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 ${
              semantic.branch.taken
                ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
                : "bg-slate-800/60 border-slate-700/80 text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base font-bold">
                {semantic.branch.taken ? "✓" : "✗"}
              </span>
              <div>
                <span className="font-bold">
                  {semantic.branch.taken
                    ? "BIFURCACIÓN TOMADA:"
                    : "BIFURCACIÓN NO TOMADA:"}
                </span>{" "}
                {semantic.branch.condition}
              </div>
            </div>
            <div className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700">
              {semantic.branch.taken
                ? `Salta a $${hexWord(semantic.branch.targetAddress)}`
                : `Secuencia: $${hexWord(semantic.branch.fallthroughAddress)}`}
            </div>
          </div>
        )}
      </div>

      {/* 2. Interactive Datapath Diagram Canvas */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
        <div className="flex items-center justify-between mb-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
          <span>Ruta de Datos de la CPU</span>
          <div className="flex items-center gap-2 font-normal lowercase tracking-normal">
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>{" "}
              Modificado
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Origen
            </span>
          </div>
        </div>

        {/* 3-Column Architecture: Registers | Bus & ALU | Memory Interface */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
          {/* Left Column: Register Bank (Cols 1-4) */}
          <div className="md:col-span-4 flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5">
            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
              <span>Banco de Registros</span>
              <span className="text-[10px] font-normal text-slate-500">
                CPU Core
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {renderRegBox("A", "8", snapshot.a)}
              {renderRegBox("B", "8", snapshot.b)}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {renderRegBox("X", "16", snapshot.x)}
              {renderRegBox("Y", "16", snapshot.y)}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {renderRegBox("SP", "16", snapshot.sp)}
              {renderRegBox("PC", "16", snapshot.pc)}
            </div>
          </div>

          {/* Center Column: System Bus & ALU (Cols 5-8) */}
          <div className="md:col-span-4 flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-2.5">
            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
              <span>Bus del Sistema & ALU</span>
              <span className="text-[10px] font-normal text-slate-500">
                Control
              </span>
            </div>

            {/* Visual Bus Line with Animation */}
            <div className="my-2 flex flex-col items-center justify-center p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 min-h-[90px]">
              <div className="w-full flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1.5">
                <span>DATAPATH</span>
                <span className="text-amber-400">
                  {isReadFlow
                    ? "BUS DE DATOS ➜ CPU"
                    : isWriteFlow
                      ? "CPU ➜ BUS DE DATOS"
                      : isInternalFlow
                        ? "BUS INTERNO CPU"
                        : isBranchOrJump
                          ? "CONTROL DEL PC"
                          : "INACTIVO"}
                </span>
              </div>

              {/* Animated SVG Bus Wire */}
              <svg
                className="w-full h-10 overflow-visible"
                viewBox="0 0 200 40"
              >
                <defs>
                  <marker
                    id="arrow-right"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#a855f7" />
                  </marker>
                  <marker
                    id="arrow-left"
                    viewBox="0 0 10 10"
                    refX="4"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M 8 1 L 0 5 L 8 9 z" fill="#06b6d4" />
                  </marker>
                </defs>

                {/* Background line */}
                <line
                  x1="10"
                  y1="20"
                  x2="190"
                  y2="20"
                  stroke="#334155"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Animated active flow line */}
                {isReadFlow && (
                  <line
                    x1="190"
                    y1="20"
                    x2="15"
                    y2="20"
                    stroke="#06b6d4"
                    strokeWidth="3.5"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    markerEnd="url(#arrow-left)"
                    className={animated ? "animate-pulse" : ""}
                    style={{
                      animation: animated
                        ? "busFlowLeft 0.8s linear infinite"
                        : "none",
                    }}
                  />
                )}

                {isWriteFlow && (
                  <line
                    x1="10"
                    y1="20"
                    x2="185"
                    y2="20"
                    stroke="#a855f7"
                    strokeWidth="3.5"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    markerEnd="url(#arrow-right)"
                    className={animated ? "animate-pulse" : ""}
                    style={{
                      animation: animated
                        ? "busFlowRight 0.8s linear infinite"
                        : "none",
                    }}
                  />
                )}

                {isInternalFlow && (
                  <path
                    d="M 20 20 Q 100 5 180 20"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeDasharray="5 3"
                    className={animated ? "animate-pulse" : ""}
                  />
                )}

                {isBranchOrJump && (
                  <line
                    x1="20"
                    y1="20"
                    x2="180"
                    y2="20"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeDasharray="4 4"
                    className={animated ? "animate-pulse" : ""}
                  />
                )}
              </svg>

              <div className="text-[10px] text-slate-500 text-center mt-1">
                {isReadFlow && "Lectura: Memoria/Inmediato ➔ CPU"}
                {isWriteFlow && "Escritura: CPU ➔ Memoria / Pila"}
                {isInternalFlow && "Transferencia / Operación interna"}
                {isBranchOrJump && "Actualización de dirección de salto"}
                {!isReadFlow &&
                  !isWriteFlow &&
                  !isInternalFlow &&
                  !isBranchOrJump &&
                  "Sin transferencia externa"}
              </div>
            </div>

            {/* ALU Trapezoid Block */}
            <div
              className={`p-2.5 rounded-lg border transition-all ${
                semantic.category === "ALU"
                  ? "border-amber-500 bg-amber-950/30 text-amber-200"
                  : "border-slate-800 bg-slate-950/40 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                <span>ALU (Unidad Aritmética)</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded ${
                    semantic.category === "ALU"
                      ? "bg-amber-400 text-slate-950 font-bold"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {semantic.category === "ALU" ? "ACTIVA" : "PASO DIRECTO"}
                </span>
              </div>
              <div className="mt-1 text-xs font-mono font-semibold">
                Op:{" "}
                <span className="text-slate-200">
                  {semantic.mnemonic.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Memory & Target Bus (Cols 9-12) */}
          <div className="md:col-span-4 flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5">
            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
              <span>Destino / Memoria</span>
              <span className="text-[10px] font-normal text-slate-500">
                Bus Externo
              </span>
            </div>

            {/* Target Address Card */}
            <div className="my-auto flex flex-col gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-mono">
                {semantic.category === "STACK"
                  ? "Pila (Stack RAM)"
                  : semantic.memoryAddress !== undefined
                    ? "Dirección Efectiva"
                    : "Operando"}
              </div>

              {semantic.memoryAddress !== undefined ? (
                <div>
                  <div className="font-mono text-sm font-bold text-slate-200 flex items-center justify-between">
                    <span>${hexWord(semantic.memoryAddress)}</span>
                    <span className="text-[10px] font-normal text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
                      {semantic.memoryAddress < 0x0040
                        ? "RAM Directa"
                        : semantic.memoryAddress < 0x00ff
                          ? "Pila / RAM"
                          : semantic.memoryAddress < 0x1000
                            ? "RAM Ext"
                            : semantic.memoryAddress <= 0x103f
                              ? "Reg I/O"
                              : "Memoria"}
                    </span>
                  </div>

                  {/* Value changes on store or read on load */}
                  {semantic.memoryNewValue !== undefined && (
                    <div className="mt-2 text-xs font-mono flex items-center justify-between p-1.5 rounded bg-purple-950/30 border border-purple-500/40 text-purple-200">
                      <span className="text-[11px] text-purple-300">
                        Escritura:
                      </span>
                      {semantic.memoryOldValue !== undefined ? (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 line-through">
                            ${hexByte(semantic.memoryOldValue)}
                          </span>
                          <span className="text-purple-400">➜</span>
                          <span className="font-bold text-purple-200">
                            ${hexByte(semantic.memoryNewValue)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-bold">
                          ${hexByte(semantic.memoryNewValue)}
                        </span>
                      )}
                    </div>
                  )}

                  {semantic.category === "LOAD" && (
                    <div className="mt-2 text-xs font-mono p-1.5 rounded bg-cyan-950/30 border border-cyan-500/40 text-cyan-200">
                      <span className="text-[11px] text-cyan-300">
                        Leído de memoria hacia CPU
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-2 text-center">
                  {semantic.sourceBlock === "IMMEDIATE"
                    ? "Valor Inmediato (#)"
                    : semantic.category === "BRANCH" ||
                        semantic.category === "JUMP"
                      ? "Salto relativo / absoluto"
                      : "Operación interna en registros"}
                </div>
              )}
            </div>

            {/* Instruction Byte Count & Timing */}
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span>Bytes: {lastStep.bytes.length}</span>
              <span>Ciclos: +{lastStep.cyclesAdded}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CCR Flags Detail & Explanations */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Estado de Banderas (CCR)
            </span>
            <span className="font-mono text-xs text-slate-400">
              ${hexByte(snapshot.ccr)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAllFlags(!showAllFlags)}
            className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {showAllFlags ? "Ocultar detalles" : "Ver explicación detallada"}
          </button>
        </div>

        {/* Flag Badges Strip */}
        <div className="grid grid-cols-8 gap-1.5">
          {(["S", "X", "H", "I", "N", "Z", "V", "C"] as const).map((flag) => {
            const flagKey =
              flag.toLowerCase() as keyof typeof snapshot.ccrFlags;
            const currentBit = snapshot.ccrFlags[flagKey] ? 1 : 0;
            const change = ccrChangesMap.get(flag);
            const isChanged = change !== undefined;

            let badgeClass = "border-slate-800 bg-slate-950/70 text-slate-400";
            if (isChanged) {
              if (change.to === 1) {
                badgeClass =
                  "border-emerald-500 bg-emerald-950/40 text-emerald-200 shadow-sm shadow-emerald-500/20";
              } else {
                badgeClass =
                  "border-rose-500 bg-rose-950/40 text-rose-200 shadow-sm shadow-rose-500/20";
              }
            } else if (currentBit === 1) {
              badgeClass = "border-slate-700 bg-slate-800 text-slate-200";
            }

            return (
              <div
                key={flag}
                className={`p-1.5 rounded-lg border text-center font-mono transition-all ${badgeClass}`}
                title={
                  isChanged
                    ? `Bandera ${flag} cambió de ${change.from} a ${change.to}`
                    : `Bandera ${flag} = ${currentBit}`
                }
              >
                <div className="text-[10px] text-slate-400 font-bold">
                  {flag}
                </div>
                <div className="text-xs font-bold mt-0.5">
                  {isChanged ? (
                    <span
                      className={
                        change.to === 1 ? "text-emerald-400" : "text-rose-400"
                      }
                    >
                      {change.to}
                    </span>
                  ) : (
                    currentBit
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CCR Explanations List */}
        {(semantic.ccrExplanations.length > 0 || showAllFlags) && (
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Impacto en Banderas:
            </span>
            {semantic.ccrExplanations.length > 0 ? (
              semantic.ccrExplanations.map((item) => (
                <div
                  key={item.flag}
                  className="flex items-start gap-2 text-xs bg-slate-950/60 p-1.5 rounded border border-slate-800/70"
                >
                  <span
                    className={`font-mono font-bold px-1.5 py-0.2 rounded text-[11px] ${
                      item.to === 1
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50"
                        : "bg-rose-950 text-rose-300 border border-rose-500/50"
                    }`}
                  >
                    {item.flag} = {item.to}
                  </span>
                  <span className="text-slate-300 text-[11px] leading-tight">
                    {item.reason}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[11px] text-slate-500 italic">
                Esta instrucción no modificó ninguna bandera del CCR.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
