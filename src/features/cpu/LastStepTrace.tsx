import { LastStep } from "../../ipc/emulator";

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

interface LastStepTraceProps {
  lastStep: LastStep | null;
  headless?: boolean;
}

export function LastStepTrace({
  lastStep,
  headless = false,
}: LastStepTraceProps) {
  if (!lastStep) {
    if (headless) {
      return (
        <p className="text-xs text-slate-500 italic">Sin ejecución reciente</p>
      );
    }
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-xs text-slate-500 italic">
        Sin ejecución reciente
      </div>
    );
  }

  const hexBytes = lastStep.bytes.map((b) => hexByte(b)).join(" ");

  const content = (
    <div className="text-xs font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-bold text-amber-300">
            {lastStep.mnemonic}
          </span>
          <span className="text-slate-400">
            Op: ${hexByte(lastStep.opcode)} ({hexBytes})
          </span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span>
            PC: ${hexWord(lastStep.pcBefore)} →{" "}
            <strong className="text-amber-400">
              ${hexWord(lastStep.pcAfter)}
            </strong>
          </span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
            +{lastStep.cyclesAdded}{" "}
            {lastStep.cyclesAdded === 1 ? "ciclo" : "ciclos"}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300">
        {lastStep.registers.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-sans">Regs:</span>
            {lastStep.registers.map((r) => (
              <span
                key={r.name}
                className="rounded bg-slate-800/80 px-1 text-cyan-300"
              >
                {r.name} ${hexWord(r.from)}→${hexWord(r.to)}
              </span>
            ))}
          </div>
        )}

        {lastStep.ccr.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-sans">CCR:</span>
            {lastStep.ccr.map((c) => (
              <span
                key={c.name}
                className="rounded bg-slate-800/80 px-1 text-amber-300"
              >
                {c.name.toUpperCase()} {c.from}→{c.to}
              </span>
            ))}
          </div>
        )}

        {lastStep.writes.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-sans">RAM:</span>
            {lastStep.writes.map((w) => (
              <span
                key={w.address}
                className="rounded bg-cyan-950/60 border border-cyan-700/50 px-1 text-cyan-300 font-semibold"
              >
                [${hexWord(w.address)}] = ${hexByte(w.old)}→${hexByte(w.new)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (headless) {
    return content;
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
      {content}
    </div>
  );
}
